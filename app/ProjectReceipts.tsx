'use client';
import React from 'react';
import { today } from '../lib/domain';
import type { ProjectReceiptRequest } from '../lib/project-receipts';

export type ReceiptDraft={depositAmount:number;depositDate:string;depositMethod:string;collectBalance:boolean;balanceDate:string;balanceMethod:string};
export function emptyReceiptDraft():ReceiptDraft{return {depositAmount:0,depositDate:today(),depositMethod:'',collectBalance:false,balanceDate:today(),balanceMethod:''};}
export function projectReceiptRequests(draft:ReceiptDraft,isNew:boolean,status:string):ProjectReceiptRequest[]{
 if(status==='cancelled')return [];
 const requests:ProjectReceiptRequest[]=[];
 if(isNew&&draft.depositAmount>0)requests.push({kind:'deposit',amount:draft.depositAmount,date:draft.depositDate,method:draft.depositMethod});
 if(status==='completed'&&draft.collectBalance)requests.push({kind:'balance',date:draft.balanceDate,method:draft.balanceMethod});
 return requests;
}

const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n);
function ReceiptFields({kind,date,method,onDate,onMethod}:{kind:'deposit'|'balance';date:string;method:string;onDate:(v:string)=>void;onMethod:(v:string)=>void}){
 const deposit=kind==='deposit';
 return <>
  <label className="form-field"><span>{deposit?'Ngày nhận cọc':'Ngày thu phần còn lại'} <i>*</i></span><input type="date" required max={today()} value={date} onChange={e=>onDate(e.target.value)}/></label>
  <label className="form-field"><span>{deposit?'Hình thức nhận cọc':'Hình thức thu phần còn lại'} <i>*</i></span><select required value={method} onChange={e=>onMethod(e.target.value)}><option value="">Chọn hình thức…</option><option value="bank">Chuyển khoản</option><option value="cash">Tiền mặt</option></select></label>
 </>;
}

export default function ProjectReceipts({isNew,value,status,alreadyPaid,draft,onChange}:{isNew:boolean;value:number;status:string;alreadyPaid:number;draft:ReceiptDraft;onChange:(d:ReceiptDraft)=>void}){
 const deposit=isNew?draft.depositAmount:0;
 const remaining=Math.max(0,value-alreadyPaid-deposit);
 if(status==='cancelled')return <div className="notice form-field full">Dự án đã hủy không ghi nhận thêm tiền cọc hoặc tiền thu.</div>;
 return <section className="project-receipts form-field full" aria-label="Tiền cọc và thanh toán">
  <h3>Tiền cọc & thanh toán</h3>
  <p>Chỉ ghi số tiền khách đã chuyển hoặc đã trả thực tế.</p>
  <div className="form-grid">
   {isNew&&<label className="form-field full"><span>Số tiền cọc đã nhận (VND)</span><input type="number" min={0} max={value} step={1} value={draft.depositAmount} onChange={e=>onChange({...draft,depositAmount:Number(e.target.value)})}/><small>Để 0 nếu chưa nhận cọc. Khoản cọc được ghi vào Tiền thực thu / chi khi lưu dự án.</small></label>}
   {isNew&&deposit>0&&<ReceiptFields kind="deposit" date={draft.depositDate} method={draft.depositMethod} onDate={v=>onChange({...draft,depositDate:v})} onMethod={v=>onChange({...draft,depositMethod:v})}/>}
   <div className="receipt-totals form-field full"><span>Đã ghi nhận thu: <b>{money(alreadyPaid)}</b></span>{deposit>0&&<span>Cọc ghi thêm: <b>{money(deposit)}</b></span>}<span>Còn theo hợp đồng: <b>{money(remaining)}</b></span></div>
   {status==='completed'&&remaining>0&&<>
    <label className="check-label form-field full"><input type="checkbox" checked={draft.collectBalance} onChange={e=>onChange({...draft,collectBalance:e.target.checked})}/>Khách đã thanh toán đủ phần còn lại</label>
    {draft.collectBalance?<><div className="notice form-field full">Khi lưu, ghi thêm khoản thực thu <b>{money(remaining)}</b>. Tổng đã thu sẽ bằng giá trị hợp đồng.</div><ReceiptFields kind="balance" date={draft.balanceDate} method={draft.balanceMethod} onDate={v=>onChange({...draft,balanceDate:v})} onMethod={v=>onChange({...draft,balanceMethod:v})}/></>:<div className="notice form-field full">Hoàn thành dịch vụ vẫn giữ khoản còn phải thu {money(remaining)} nếu chưa xác nhận nhận đủ tiền.</div>}
   </>}
   {status==='completed'&&remaining===0&&<div className="notice form-field full">Đã đủ giá trị hợp đồng sau các khoản thu ở trên. Không tạo thêm khoản thu còn lại.</div>}
  </div>
 </section>;
}
