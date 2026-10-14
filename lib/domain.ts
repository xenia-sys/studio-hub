export type Row = { id: string; [key: string]: any };
export type Collection = 'customers' | 'projects' | 'staff' | 'tasks' | 'costs' | 'payments';
export type Role = 'owner' | 'manager' | 'finance' | 'viewer';
export type Identity = {userId:string; email:string; displayName:string};
export type Member = {id:string; email:string; name:string; userId?:string; role:Role; active:boolean};
export type Workspace = {
  settings: { name:string; services:string[]; capacity:string; resourceNotes:string; discoveryDone:boolean };
  customers:Row[]; projects:Row[]; staff:Row[]; tasks:Row[]; costs:Row[]; payments:Row[];
  members:Member[]; audit:Row[]; demoLoaded:boolean;
};
export const SERVICES = ['Nhiếp ảnh', 'Cho thuê studio', 'Video', 'Thiết kế', 'Sự kiện', 'Cho thuê thiết bị', 'In ấn'];
export const ROLES: Record<Role,string> = {owner:'Chủ studio',manager:'Quản lý vận hành',finance:'Tài chính',viewer:'Chỉ xem'};
export const PROJECT_STATUS:Record<string,string> = {quote:'Báo giá',confirmed:'Đã xác nhận',ongoing:'Đang thực hiện',completed:'Hoàn thành',cancelled:'Đã hủy'};
export const TASK_STATUS:Record<string,string>={todo:'Cần làm',doing:'Đang làm',done:'Hoàn thành'};
export const CUSTOMER_STATUS:Record<string,string>={lead:'Tiềm năng',active:'Đang hợp tác',returning:'Khách quay lại'};
export class AppError extends Error { status:number; constructor(message:string,status=400){super(message);this.status=status;} }
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function uid(){return crypto.randomUUID();}
export function emptyWorkspace(u:Identity):Workspace{return {
 settings:{name:'Studio Hub',services:SERVICES,capacity:'Nhóm quản lý',resourceNotes:'',discoveryDone:false},
 customers:[],projects:[],staff:[],tasks:[],costs:[],payments:[],audit:[],demoLoaded:false,
 members:[{id:uid(),email:u.email.toLowerCase(),userId:u.userId,name:u.displayName,role:'owner',active:true}]
};}
export function memberFor(s:Workspace,u:Identity):Member {
 const member=s.members.find(m=>m.active&&(m.userId===u.userId||(!m.userId&&m.email===u.email.toLowerCase())));
 if(!member)throw new AppError('Tài khoản chưa được cấp quyền trong studio. Liên hệ chủ studio.',403);
 return member;
}
export function canWrite(role:Role,col:string){return role==='owner'||(role==='manager'&&['customers','projects','staff','tasks'].includes(col))||(role==='finance'&&['costs','payments'].includes(col));}
export function financial(role:Role){return role==='owner'||role==='finance';}
export function visibleState(s:Workspace,m:Member){const copy=structuredClone(s);
 if(!financial(m.role)){copy.costs=[];copy.payments=[];copy.projects=copy.projects.map(({value,...r})=>r as Row);}
 if(m.role!=='owner'){copy.members=[];copy.audit=[];}
 return copy;
}
function str(d:Row,k:string,required=false,max=2000){const v=String(d[k]??'').trim();if(required&&!v)throw new AppError('Vui lòng điền '+k+'.');if(v.length>max)throw new AppError('Nội dung quá dài.');return v;}
function amount(v:any,allowZero=false){const n=Number(v);if(!Number.isSafeInteger(n)||n<(allowZero?0:1)||n>1e12)throw new AppError('Số tiền phải là số nguyên VND hợp lệ.');return n;}
function date(v:any,required=false){const d=String(v||'');if(!d&&!required)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(new Date(d+'T00:00:00Z').getTime())||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)throw new AppError('Ngày không hợp lệ.');return d;}
function choose(v:any,values:string[]){if(!values.includes(v))throw new AppError('Lựa chọn không hợp lệ.');return String(v);}
function ref(s:Workspace,c:Collection,id:any,required=false){const v=String(id||'');if(!v&&!required)return '';if(!s[c].some(r=>r.id===v))throw new AppError('Bản ghi liên kết không tồn tại.');return v;}
export function paidProject(s:Workspace,id:string){return s.payments.filter(p=>p.direction==='in'&&p.projectId===id).reduce((a,p)=>a+p.amount,0);}
export function paidCost(s:Workspace,id:string){return s.payments.filter(p=>p.direction==='out'&&p.costId===id).reduce((a,p)=>a+p.amount,0);}
export function normalize(s:Workspace,c:Collection,input:Row,existing?:Row):Row{
 const d=input; const base={id:existing?.id||uid(),updatedAt:new Date().toISOString()};
 if(c==='customers')return {...base,name:str(d,'name',true,160),contact:str(d,'contact',false,160),email:str(d,'email',false,200),source:str(d,'source',false,80),status:choose(d.status,Object.keys(CUSTOMER_STATUS)),followup:date(d.followup),notes:str(d,'notes')};
 if(c==='staff')return {...base,name:str(d,'name',true,160),job:str(d,'job',true,160),email:str(d,'email',false,200),contact:str(d,'contact',false,160),type:choose(d.type,['fulltime','freelance','parttime']),status:choose(d.status,['active','inactive']),capacity:Math.max(1,Math.min(168,Number(d.capacity)||40)),notes:str(d,'notes')};
 if(c==='projects'){
  const value=amount(d.value,true);if(existing&&value<paidProject(s,existing.id))throw new AppError('Giá trị hợp đồng không được thấp hơn tiền đã thu.');
  const status=choose(d.status,Object.keys(PROJECT_STATUS));
  if(status==='cancelled'&&existing&&paidProject(s,existing.id)>0)throw new AppError('Dự án đã thu tiền. Cần xử lý giao dịch trước khi hủy.');
  const owners=Array.isArray(d.staffIds)?d.staffIds.map((x:string)=>ref(s,'staff',x,true)):[];
  const start=date(d.start),due=date(d.due,true);if(start&&start>due)throw new AppError('Ngày bắt đầu phải trước hạn bàn giao.');
  const completedAt=status==='completed'?date(d.completedAt,true):'';
  if(completedAt&&completedAt>today())throw new AppError('Ngày hoàn thành không được ở tương lai.');
  const service=choose(d.service,s.settings.services);
  const room=str(d,'resource',false,160),endTime=str(d,'endTime',false,8),startTime=str(d,'startTime',false,8);
  if(startTime||endTime){if(!/^\d{2}:[0-5]\d$/.test(startTime)||!/^\d{2}:[0-5]\d$/.test(endTime)||startTime>=endTime||endTime>'23:59'||startTime>'23:59')throw new AppError('Khoảng giờ booking không hợp lệ.');}
  if(room&&start&&startTime&&status!=='cancelled'&&s.projects.some(p=>p.id!==existing?.id&&p.status!=='cancelled'&&p.resource===room&&p.start===start&&p.startTime&&p.startTime<endTime&&startTime<p.endTime))throw new AppError('Tài nguyên đã có booking trùng giờ.');
  return {...base,name:str(d,'name',true,180),clientId:ref(s,'customers',d.clientId,true),service,value,status,start,due,completedAt,staffIds:owners,resource:room,startTime,endTime,notes:str(d,'notes')};
 }
 if(c==='tasks')return {...base,name:str(d,'name',true,180),projectId:ref(s,'projects',d.projectId),staffId:ref(s,'staff',d.staffId,true),due:date(d.due,true),status:choose(d.status,Object.keys(TASK_STATUS)),hours:Math.max(0,Math.min(1000,Number(d.hours)||0)),notes:str(d,'notes')};
 if(c==='costs'){
  const value=amount(d.amount);if(existing&&value<paidCost(s,existing.id))throw new AppError('Chi phí không được thấp hơn số tiền đã trả.');
  const incurredAt=date(d.incurredAt,true);if(incurredAt>today())throw new AppError('Chỉ ghi nhận chi phí đã phát sinh; không dùng ngày tương lai.');
  return {...base,name:str(d,'name',true,180),amount:value,projectId:ref(s,'projects',d.projectId),category:choose(d.category,['production','rent','payroll','equipment','marketing','other']),incurredAt,due:date(d.due),notes:str(d,'notes')};
 }
 if(c==='payments'){
  const direction=choose(d.direction,['in','out']);const value=amount(d.amount);const at=date(d.date,true);if(at>today())throw new AppError('Chỉ ghi tiền đã thực thu/chi, không dùng ngày tương lai.');
  const projectId=direction==='in'?ref(s,'projects',d.projectId,true):'';
  const costId=direction==='out'?ref(s,'costs',d.costId,true):'';
  const others=s.payments.filter(p=>p.id!==existing?.id);
  const paid=others.filter(p=>direction==='in'?p.direction==='in'&&p.projectId===projectId:p.direction==='out'&&p.costId===costId).reduce((a,p)=>a+p.amount,0);
  const limit=direction==='in'?s.projects.find(p=>p.id===projectId)!.value:s.costs.find(p=>p.id===costId)!.amount;
  if(paid+value>limit)throw new AppError(direction==='in'?'Tiền thu vượt giá trị hợp đồng. Hãy điều chỉnh hợp đồng trước.':'Tiền trả vượt tổng chi phí.');
  if(direction==='in'&&s.projects.find(p=>p.id===projectId)?.status==='cancelled')throw new AppError('Không thể thu cho dự án đã hủy.');
  return {...base,name:str(d,'name',true,180),direction,amount:value,date:at,projectId,costId,method:choose(d.method,['bank','cash']),notes:str(d,'notes')};
 }
 throw new AppError('Loại dữ liệu không hợp lệ.');
}
export function metrics(s:Workspace,month=''){
 const inPeriod=(d:string)=>!month||d?.startsWith(month);
 const revenue=s.projects.filter(p=>p.status==='completed'&&inPeriod(p.completedAt)).reduce((a,p)=>a+(p.value||0),0);
 const costs=s.costs.filter(c=>inPeriod(c.incurredAt)).reduce((a,c)=>a+c.amount,0);
 const cashIn=s.payments.filter(p=>p.direction==='in'&&inPeriod(p.date)).reduce((a,p)=>a+p.amount,0);
 const cashOut=s.payments.filter(p=>p.direction==='out'&&inPeriod(p.date)).reduce((a,p)=>a+p.amount,0);
 const receivable=s.projects.filter(p=>p.status==='completed').reduce((a,p)=>a+Math.max(0,p.value-paidProject(s,p.id)),0);
 const payable=s.costs.reduce((a,c)=>a+Math.max(0,c.amount-paidCost(s,c.id)),0);
 const deposits=s.projects.filter(p=>!['completed','cancelled'].includes(p.status)).reduce((a,p)=>a+paidProject(s,p.id),0);
 return {revenue,costs,profit:revenue-costs,cashIn,cashOut,netCash:cashIn-cashOut,receivable,payable,deposits};
}
export function deleteRecord(s:Workspace,c:Collection,id:string){
 const r=s[c].find(x=>x.id===id);if(!r)throw new AppError('Bản ghi không tồn tại.',404);
 if(c==='customers'&&s.projects.some(p=>p.clientId===id))throw new AppError('Khách hàng đang liên kết dự án.');
 if(c==='projects'&&(s.tasks.some(t=>t.projectId===id)||s.costs.some(t=>t.projectId===id)||s.payments.some(t=>t.projectId===id)))throw new AppError('Dự án có công việc hoặc tài chính liên kết.');
 if(c==='staff'&&(s.tasks.some(t=>t.staffId===id)||s.projects.some(p=>p.staffIds?.includes(id))))throw new AppError('Nhân sự có công việc hoặc dự án liên kết. Chuyển sang ngừng hợp tác.');
 if(c==='costs'&&s.payments.some(p=>p.costId===id))throw new AppError('Chi phí đã có thanh toán liên kết.');
 s[c]=s[c].filter(x=>x.id!==id);
}
