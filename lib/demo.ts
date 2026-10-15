import { emptyWorkspace, today, type Identity, type Workspace } from './domain.ts';
export function demoWorkspace(user:Identity):Workspace {
 const s=emptyWorkspace(user);const t=today();const prefix=t.slice(0,8);const day=Number(t.slice(8));const before=(n:number)=>prefix+String(Math.max(1,day-n)).padStart(2,'0');
 const future=(n:number)=>{const d=new Date(t+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 s.settings={...s.settings,discoveryDone:true};s.demoLoaded=true;
 s.customers=[
 {id:'c1',name:'Linen Atelier',contact:'090 000 0101',email:'contact@linen.example',source:'Instagram',status:'returning',followup:future(3),notes:'Khách mẫu · Bộ ảnh lookbook mùa mới.'},
 {id:'c2',name:'Mộc Coffee',contact:'090 000 0102',source:'Giới thiệu',status:'active',followup:future(1),notes:'Khách mẫu · Cần video social hàng tháng.'},
 {id:'c3',name:'An Design',contact:'090 000 0103',source:'Website',status:'lead',followup:t,notes:'Khách mẫu · Đang chốt nhu cầu.'},
 {id:'c4',name:'The Makers',contact:'090 000 0104',source:'Đối tác',status:'active',followup:future(5),notes:'Khách mẫu · Sự kiện ra mắt.'},
 {id:'c5',name:'Sunday Studio',contact:'090 000 0105',source:'Instagram',status:'returning',followup:future(7),notes:'Khách mẫu · Thuê thiết bị.'},
 {id:'c6',name:'Nhà Của Nắng',contact:'090 000 0106',source:'Website',status:'lead',followup:before(1),notes:'Khách mẫu · Báo giá thiết kế.'}
 ];
 s.staff=[{id:'s1',name:'Minh Anh',job:'Producer',email:'anh@studio.example',type:'fulltime',status:'active',capacity:40},{id:'s2',name:'Gia Huy',job:'Photographer',email:'huy@studio.example',type:'freelance',status:'active',capacity:24},{id:'s3',name:'Thanh Vy',job:'Designer',email:'vy@studio.example',type:'fulltime',status:'active',capacity:40},{id:'s4',name:'Hoàng Nam',job:'Video editor',email:'nam@studio.example',type:'parttime',status:'active',capacity:24}];
 s.projects=[
 {id:'p1',name:'Linen / Lookbook vol.02',clientId:'c1',service:'Nhiếp ảnh',value:28000000,status:'completed',start:before(8),due:before(4),completedAt:before(4),staffIds:['s1','s2'],resource:'Studio A',startTime:'09:00',endTime:'15:00'},
 {id:'p2',name:'Mộc / Social film',clientId:'c2',service:'Video',value:35000000,status:'ongoing',start:before(2),due:future(4),staffIds:['s1','s4'],notes:'Bàn giao 3 video ngắn.'},
 {id:'p3',name:'The Makers / Launch night',clientId:'c4',service:'Sự kiện',value:52000000,status:'confirmed',start:future(5),due:future(7),staffIds:['s1'],resource:'Không gian sự kiện',startTime:'17:00',endTime:'22:00'},
 {id:'p4',name:'An / Brand direction',clientId:'c3',service:'Thiết kế',value:18000000,status:'quote',start:t,due:future(9),staffIds:['s3']},
 {id:'p5',name:'Sunday / Camera rental',clientId:'c5',service:'Cho thuê thiết bị',value:4500000,status:'completed',start:before(3),due:before(2),completedAt:before(2),staffIds:['s2']},
 {id:'p6',name:'Linen / Studio booking',clientId:'c1',service:'Cho thuê studio',value:6000000,status:'confirmed',start:future(2),due:future(2),staffIds:['s2'],resource:'Studio A',startTime:'08:00',endTime:'12:00'},
 {id:'p7',name:'The Makers / Print kit',clientId:'c4',service:'In ấn',value:8500000,status:'completed',start:before(5),due:before(1),completedAt:before(1),staffIds:['s3']}
 ];
 s.tasks=[{id:'t1',name:'Duyệt rough cut video Mộc',projectId:'p2',staffId:'s4',due:t,status:'doing',hours:8},{id:'t2',name:'Gửi báo giá brand direction',projectId:'p4',staffId:'s3',due:future(1),status:'todo',hours:3},{id:'t3',name:'Chốt run-of-show sự kiện',projectId:'p3',staffId:'s1',due:future(2),status:'todo',hours:6},{id:'t4',name:'Kiểm tra kit máy & ánh sáng',projectId:'p6',staffId:'s2',due:future(1),status:'todo',hours:4},{id:'t5',name:'Bàn giao ảnh lookbook',projectId:'p1',staffId:'s2',due:before(4),status:'done',hours:6}];
 s.costs=[{id:'e1',name:'Crew lookbook',amount:8000000,projectId:'p1',category:'production',incurredAt:before(8),due:before(4)},{id:'e2',name:'Đạo cụ & bối cảnh',amount:2500000,projectId:'p1',category:'production',incurredAt:before(8),due:before(4)},{id:'e3',name:'Thuê mặt bằng tháng này',amount:12000000,projectId:'',category:'rent',incurredAt:before(10),due:before(5)},{id:'e4',name:'Freelancer video',amount:5500000,projectId:'p2',category:'production',incurredAt:before(2),due:future(3)},{id:'e5',name:'Sản xuất print kit',amount:3500000,projectId:'p7',category:'production',incurredAt:before(5),due:t}];
 s.payments=[{id:'m1',name:'Thanh toán lookbook',direction:'in',projectId:'p1',amount:20000000,date:before(4),method:'bank'},{id:'m2',name:'Đặt cọc video',direction:'in',projectId:'p2',amount:15000000,date:before(2),method:'bank'},{id:'m3',name:'Đặt cọc sự kiện',direction:'in',projectId:'p3',amount:20000000,date:before(1),method:'bank'},{id:'m4',name:'Thanh toán thuê máy',direction:'in',projectId:'p5',amount:4500000,date:before(2),method:'cash'},{id:'m5',name:'Trả crew',direction:'out',costId:'e1',amount:8000000,date:before(4),method:'bank'},{id:'m6',name:'Trả đạo cụ',direction:'out',costId:'e2',amount:2500000,date:before(4),method:'cash'},{id:'m7',name:'Trả tiền thuê',direction:'out',costId:'e3',amount:12000000,date:before(5),method:'bank'},{id:'m8',name:'Ứng freelancer',direction:'out',costId:'e4',amount:2000000,date:before(1),method:'bank'}];
 return s;
}
