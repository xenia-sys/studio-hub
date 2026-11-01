import { AppError, normalize, paidProject, type Row, type Workspace } from './domain.ts';

export type ProjectReceiptRequest = {
 kind: 'deposit' | 'balance';
 amount?: number;
 date: string;
 method: string;
};

/** Studio rule: saving a completed project also settles its remaining contract balance. */
export function completeProjectReceipt(s:Workspace,project:Row){
 if(project.status!=='completed')return;
 const remaining=project.value-paidProject(s,project.id);
 if(remaining<=0)return;
 if(s.payments.length>=5000)throw new AppError('Đã đạt giới hạn 5.000 giao dịch.');
 const receipt=normalize(s,'payments',{id:'',name:('Tự động thu đủ · '+project.name).slice(0,180),direction:'in',amount:remaining,projectId:project.id,date:project.completedAt,method:'unspecified',notes:'Tự động ghi thu theo quy tắc chủ studio: dự án Hoàn thành được xem là đã thu đủ giá trị hợp đồng. Đã trừ các khoản cọc và tiền thu đã ghi. Ngày giao dịch dùng ngày hoàn thành; hình thức thanh toán chưa xác định, có thể cập nhật sau khi đối chiếu.'});
 receipt.automaticReceipt=true;
 s.payments.push(receipt);
 return receipt;
}

/** Called after project validation, before the single workspace compare-and-swap. */
export function recordProjectReceipts(s:Workspace,project:Row,isNew:boolean,input:unknown){
 if(!Array.isArray(input)||input.length>2)throw new AppError('Thông tin nhận tiền dự án không hợp lệ.');
 if(!input.length)return [];
 if(project.status==='cancelled')throw new AppError('Không thể nhận tiền cho dự án đã hủy.');
 const kinds=new Set<string>();
 for(const r of input){
  if(!r||typeof r!=='object'||!['deposit','balance'].includes(r.kind)||kinds.has(r.kind))throw new AppError('Mỗi lần lưu chỉ ghi một khoản cọc và một khoản thu còn lại.');
  kinds.add(r.kind);
  if(r.kind==='deposit'&&!isNew)throw new AppError('Cọc ban đầu chỉ ghi khi tạo dự án mới. Dùng Ghi thu tiền để nhận thêm.');
  if(r.kind==='balance'&&project.status!=='completed')throw new AppError('Chỉ xác nhận thu đủ ở bước hoàn thành dự án.');
 }
 const deposit=input.find(r=>r.kind==='deposit'),balance=input.find(r=>r.kind==='balance');
 if(deposit&&balance&&deposit.date>balance.date)throw new AppError('Ngày thu phần còn lại không được trước ngày nhận cọc.');
 const created:Row[]=[];
 for(const request of [deposit,balance].filter(Boolean)){
  const value=request.kind==='balance'?project.value-paidProject(s,project.id):request.amount;
  // An already settled project must not acquire another receipt when saved again.
  if(request.kind==='balance'&&value===0)continue;
  const name=(request.kind==='deposit'?'Đặt cọc · ':'Thu phần còn lại · ')+project.name;
  const receipt=normalize(s,'payments',{id:'',name:name.slice(0,180),direction:'in',amount:value,projectId:project.id,date:request.date,method:request.method,notes:request.kind==='deposit'?'Tiền cọc thực nhận, ghi cùng lúc tạo dự án.':'Đã nhận đủ phần còn lại theo xác nhận khi lưu dự án hoàn thành.'});
  if(s.payments.length>=5000)throw new AppError('Đã đạt giới hạn 5.000 giao dịch.');
  s.payments.push(receipt);created.push(receipt);
 }
 return created;
}
