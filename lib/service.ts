import { AppError, canWrite, memberFor, visibleState, normalize, deleteRecord, uid, SERVICES, type Collection, type Identity, type Workspace, type Row } from './domain.ts';
import { demoWorkspace } from './demo.ts';
import type { WorkspaceStore } from './store.ts';
const COLLECTIONS=['customers','projects','staff','tasks','costs','payments'];
export async function readWorkspace(store:WorkspaceStore,u:Identity,ownerEmail:string){
 let row=await store.read();
 if(!row){
  if(!ownerEmail||u.email.toLowerCase()!==ownerEmail.trim().toLowerCase())throw new AppError('Studio chưa được khởi tạo. Chỉ chủ studio đã cấu hình được mở lần đầu.',403);
  await store.initialize(demoWorkspace(u));row=await store.read();
 }
 if(!row)throw new AppError('Không thể mở dữ liệu studio.',503);
 const state=row.state;const member=memberFor(state,u);
 return {state,member,revision:row.revision};
}
export async function getState(store:WorkspaceStore,u:Identity,ownerEmail:string){
 for(let attempt=0;attempt<4;attempt++){
  const {state,member,revision}=await readWorkspace(store,u,ownerEmail);
  if(!member.userId){
   member.userId=u.userId;
   if(!await store.compareAndSwap(state,revision))continue;
   return {state:visibleState(state,member),me:member,revision:revision+1};
  }
  return {state:visibleState(state,member),me:member,revision};
 }
 throw new AppError('Có thay đổi đồng thời. Tải lại dữ liệu và thử lại.',409);
}
export async function mutate(store:WorkspaceStore,u:Identity,body:any,ownerEmail:string){
 const {state:s,member:m,revision}=await readWorkspace(store,u,ownerEmail);
 if(body.revision!==revision)throw new AppError('Dữ liệu vừa thay đổi bởi người khác. Đã tải bản mới; vui lòng thử lưu lại.',409);
 const col=body.collection as Collection; let detail='';let action=body.action;
 if(['save','delete'].includes(action)){
  if(!COLLECTIONS.includes(col))throw new AppError('Loại dữ liệu không hợp lệ.');
  if(!canWrite(m.role,col))throw new AppError('Vai trò của bạn không có quyền thao tác mục này.',403);
  if(action==='save'){
   const input=body.record as Row;if(!input||typeof input!=='object')throw new AppError('Thiếu dữ liệu.');
   const existing=input.id?s[col].find(r=>r.id===input.id):undefined;
   if(input.id&&!existing)throw new AppError('Bản ghi không tồn tại.',404);
   // Operational managers cannot change financial contract values.
   if(m.role==='manager'&&col==='projects')input.value=existing?.value??0;
   const normalized=normalize(s,col,input,existing);
   if(s[col].length>=5000&&!existing)throw new AppError('Đã đạt giới hạn 5.000 bản ghi mỗi mục của bản thử nghiệm.');
   if(existing)s[col]=s[col].map(r=>r.id===existing.id?normalized:r);else s[col].push(normalized);
   detail=normalized.name;
  }else{const item=s[col].find(r=>r.id===body.id);deleteRecord(s,col,body.id);detail=item?.name||body.id;}
 }else if(action==='settings'){
  if(m.role!=='owner')throw new AppError('Chỉ chủ studio được cấu hình.',403);
  const d=body.settings;if(!d||typeof d.name!=='string'||!d.name.trim()||d.name.length>100)throw new AppError('Tên studio không hợp lệ.');
  const services=Array.isArray(d.services)?d.services.filter((x:string)=>SERVICES.includes(x)):[];
  if(!services.length)throw new AppError('Chọn ít nhất một dịch vụ.');
  if(s.projects.some(p=>!services.includes(p.service)))throw new AppError('Không thể bỏ dịch vụ còn dự án liên kết.');
  s.settings={name:d.name.trim(),services,capacity:String(d.capacity||'Nhóm quản lý').slice(0,200),resourceNotes:String(d.resourceNotes||'').slice(0,2000),discoveryDone:true};detail=d.name;
 }else if(action==='member'){
  if(m.role!=='owner')throw new AppError('Chỉ chủ studio được cấp quyền.',403);
  const d=body.member;const email=String(d?.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200)throw new AppError('Email không hợp lệ.');
  if(!['manager','finance','viewer'].includes(d.role))throw new AppError('Vai trò không hợp lệ.');
  const existing=s.members.find(x=>x.email===email);if(existing?.role==='owner')throw new AppError('Không thể đổi quyền chủ studio.');
  const next={id:existing?.id||uid(),email,name:String(d.name||email).slice(0,160),role:d.role,active:d.active!==false,userId:existing?.userId};
  if(existing)s.members=s.members.map(x=>x.id===existing.id?next:x);else s.members.push(next);detail=email;
 }else if(action==='clearDemo'){
  if(m.role!=='owner')throw new AppError('Chỉ chủ studio được chuyển sang dữ liệu thật.',403);
  if(!s.demoLoaded)throw new AppError('Studio đang dùng dữ liệu thật.');
  if(body.confirm!==s.settings.name)throw new AppError('Nhập đúng tên studio để xác nhận.');
  // Prevent clearing real changes accidentally: the UI explicitly lists all records removed.
  for(const k of COLLECTIONS)s[k as Collection]=[];s.demoLoaded=false;detail='Xóa bộ dữ liệu thử, bắt đầu dữ liệu thật';
 }else if(action==='demo'){
  if(m.role!=='owner')throw new AppError('Chỉ chủ studio được nạp dữ liệu mẫu.',403);
  if(COLLECTIONS.some(c=>s[c as Collection].length))throw new AppError('Chỉ nạp mẫu khi các mục dữ liệu đang trống.');
  const demo=demoWorkspace(u);for(const c of COLLECTIONS)s[c as Collection]=demo[c as Collection];s.demoLoaded=true;detail='Nạp dữ liệu mẫu';
 }else throw new AppError('Thao tác không hợp lệ.');
 // Bind invited members to the Supabase's stable ID after first authorized write.
 if(!m.userId)m.userId=u.userId;
 s.audit.unshift({id:uid(),at:new Date().toISOString(),by:u.email,action,col:col||'',detail});s.audit=s.audit.slice(0,500);
 const saved=await store.compareAndSwap(s,revision);
 if(!saved)throw new AppError('Có thay đổi đồng thời. Tải lại dữ liệu và thử lưu lại.',409);
 return {state:visibleState(s,m),me:{...m,userId:u.userId},revision:revision+1};
}
