import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { database, postgresStore } from './helpers';
import { getState, mutate } from '../lib/service.ts';
import { metrics, today, type Collection } from '../lib/domain.ts';
let pg:any,db:any;const owner={userId:'owner',email:'owner@studio.test',displayName:'Owner'};
const manager={userId:'manager',email:'manager@studio.test',displayName:'Manager'},fin={userId:'finance',email:'finance@studio.test',displayName:'Finance'},viewer={userId:'viewer',email:'viewer@studio.test',displayName:'Viewer'};
let bundle:any;
async function action(a:any,u=owner){const b=await getState(db,u,owner.email);return mutate(db,u,{...a,revision:b.revision},owner.email);}
async function create(c:Collection,r:any,u=owner){const b=await action({action:'save',collection:c,record:r},u);return b.state[c].at(-1);}
before(async()=>{pg=await database();db=postgresStore(pg);});
after(async()=>await pg.close());
test('private bootstrap, demo totals and protected membership',async()=>{
 bundle=await getState(db,owner,owner.email);assert.equal(bundle.me.role,'owner');assert.equal(bundle.state.demoLoaded,true);
 const m=metrics(bundle.state,today().slice(0,7));assert.equal(m.revenue,41000000);assert.equal(m.costs,31500000);assert.equal(m.profit,9500000);assert.equal(m.cashIn,59500000);assert.equal(m.cashOut,24500000);assert.equal(m.netCash,35000000);assert.equal(m.receivable,16500000);assert.equal(m.deposits,35000000);
 await assert.rejects(getState(db,{...viewer,email:'stranger@studio.test'},owner.email),(e:any)=>e.status===403);
 await assert.rejects(action({action:'clearDemo',confirm:'wrong'}),/Nhập đúng/);
 await action({action:'clearDemo',confirm:'Studio Hub'});assert.equal((await getState(db,owner,owner.email)).state.projects.length,0);
});
let client:any,person:any,project:any,cost:any,payment:any;
test('CRM → personnel → project → deposit → cost → payment → completion',async()=>{
 client=await create('customers',{name:'Khách thật thử nghiệm',contact:'0901234567',status:'lead',source:'Instagram',followup:today()});
 person=await create('staff',{name:'Test photographer',job:'Photographer',type:'freelance',status:'active',capacity:24});
 project=await create('projects',{name:'Chụp sản phẩm',clientId:client.id,service:'Nhiếp ảnh',value:10000000,status:'confirmed',start:today(),due:today(),resource:'Studio A',startTime:'09:00',endTime:'12:00',staffIds:[person.id]});
 payment=await create('payments',{name:'Cọc 30%',direction:'in',amount:3000000,projectId:project.id,date:today(),method:'bank'});
 let state=(await getState(db,owner,owner.email)).state;assert.equal(metrics(state).revenue,0);assert.equal(metrics(state).deposits,3000000);assert.equal(metrics(state).netCash,3000000);
 cost=await create('costs',{name:'Crew',amount:2000000,projectId:project.id,category:'production',incurredAt:today()});
 await create('payments',{name:'Trả crew',direction:'out',amount:1000000,costId:cost.id,date:today(),method:'bank'});
 await action({action:'save',collection:'projects',record:{...project,status:'completed',completedAt:today()}});
 state=(await getState(db,owner,owner.email)).state;const m=metrics(state);assert.equal(m.revenue,10000000);assert.equal(m.profit,8000000);assert.equal(m.netCash,2000000);assert.equal(m.receivable,7000000);assert.equal(m.payable,1000000);assert.equal(m.deposits,0);
 const task=await create('tasks',{name:'Bàn giao ảnh',projectId:project.id,staffId:person.id,status:'todo',due:today(),hours:3});
 await action({action:'save',collection:'tasks',record:{...task,status:'done'}});assert.equal((await getState(db,owner,owner.email)).state.tasks[0].status,'done');
});
test('linked deletion, over-collection, overpayment, future date and booking collision are blocked',async()=>{
 await assert.rejects(action({action:'delete',collection:'customers',id:client.id}),/liên kết/);
 await assert.rejects(action({action:'delete',collection:'costs',id:cost.id}),/liên kết/);
 await assert.rejects(create('payments',{name:'Over receipt',direction:'in',amount:8000000,projectId:project.id,date:today(),method:'bank'}),/vượt/);
 await assert.rejects(create('payments',{name:'Over payment',direction:'out',amount:2000000,costId:cost.id,date:today(),method:'bank'}),/vượt/);
 await assert.rejects(create('projects',{...project,id:undefined,name:'Trùng lịch',startTime:'11:00',endTime:'13:00'}),/trùng giờ/);
 await assert.rejects(create('projects',{...project,id:undefined,name:'Giờ sai',startTime:'09:99',endTime:'12:00'}),/không hợp lệ/);
 await assert.rejects(create('costs',{name:'Future',amount:1000,category:'other',incurredAt:'2099-01-01'}),/tương lai/);
 await assert.rejects(create('costs',{name:'Date error',amount:1000,category:'other',incurredAt:'2026-13-99'}),/không hợp lệ/);
});
test('server authorization and confidential data filtering for 3 roles',async()=>{
 for(const [u,role]of [[manager,'manager'],[fin,'finance'],[viewer,'viewer']] as const)await action({action:'member',member:{name:u.displayName,email:u.email,role}});
 const b=await getState(db,manager,owner.email);assert.equal(b.state.costs.length,0);assert.equal(b.state.payments.length,0);assert.equal(b.state.projects[0].value,undefined);assert.equal(b.state.members.length,0);assert.equal(b.state.audit.length,0);
 await assert.rejects(create('costs',{name:'No rights',amount:1,incurredAt:today(),category:'other'},manager),(e:any)=>e.status===403);
 await assert.rejects(create('customers',{name:'No rights',status:'lead'},viewer),(e:any)=>e.status===403);
 await assert.rejects(create('staff',{name:'No rights',job:'Test',type:'fulltime',status:'active'},fin),(e:any)=>e.status===403);
 await assert.rejects(action({action:'member',member:{email:'intruder@studio.test',role:'owner'}},manager),(e:any)=>e.status===403);
 const visible=b.state.projects[0];await action({action:'save',collection:'projects',record:{...visible,name:'Manager updated',value:9999999999}},manager);assert.equal((await getState(db,owner,owner.email)).state.projects[0].value,10000000);
 await create('costs',{name:'Finance allowed',amount:1000,incurredAt:today(),category:'other'},fin);
 await action({action:'member',member:{email:viewer.email,name:'Viewer',role:'viewer',active:false}});await assert.rejects(getState(db,viewer,owner.email),(e:any)=>e.status===403);
});
test('atomic optimistic concurrency prevents lost updates',async()=>{
 const b=await getState(db,owner,owner.email);const changes=await Promise.allSettled([mutate(db,owner,{revision:b.revision,action:'save',collection:'customers',record:{name:'Concurrent A',status:'lead'}},owner.email),mutate(db,owner,{revision:b.revision,action:'save',collection:'customers',record:{name:'Concurrent B',status:'lead'}},owner.email)]);
 assert.equal(changes.filter(c=>c.status==='fulfilled').length,1);assert.equal(changes.filter(c=>c.status==='rejected'&&c.reason.status===409).length,1);
 assert.equal((await getState(db,owner,owner.email)).state.customers.filter(c=>c.name.startsWith('Concurrent')).length,1);
});
test('state survives independent reads and deletions refresh cash totals',async()=>{
 await action({action:'delete',collection:'payments',id:payment.id});const b=await getState(db,owner,owner.email);assert.equal(metrics(b.state).cashIn,0);assert.equal(metrics(b.state).receivable,10000000);assert.ok(b.state.audit.length>0);
 await assert.rejects(action({action:'demo'}),/trống/);
});
test('only configured owner can initialize, stable IDs prevent email takeover, and inactive members stay blocked',async()=>{
 const fresh=await database();const store=postgresStore(fresh);
 try{
  await assert.rejects(getState(store,viewer,owner.email),(e:any)=>e.status===403);
  await assert.rejects(getState(store,owner,''),(e:any)=>e.status===403);
  assert.equal(await store.read(),null);
  await getState(store,owner,owner.email);
  await assert.rejects(getState(store,{...owner,userId:'different-auth-user'},owner.email),(e:any)=>e.status===403);
 }finally{await fresh.close();}
});
