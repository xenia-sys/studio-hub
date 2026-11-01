import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { database, postgresStore } from './helpers';
import { getState, mutate } from '../lib/service.ts';
import { emptyWorkspace, paidProject, metrics, today } from '../lib/domain.ts';
import ProjectReceipts, { emptyReceiptDraft, projectReceiptRequests } from '../app/ProjectReceipts';

const owner={userId:'receipt-owner',email:'owner@receipt.test',displayName:'Owner'};
const manager={userId:'receipt-manager',email:'manager@receipt.test',displayName:'Manager'};
const base=()=>({id:'',name:'Booking test',clientId:'client',service:'Cho thuê studio',value:1000000,status:'confirmed',start:today(),due:today(),staffIds:[]});
const deposit=(amount=300000)=>({kind:'deposit',amount,date:today(),method:'bank'});
const balance=()=>({kind:'balance',date:today(),method:'cash'});
async function fixture(run:(ctx:any)=>Promise<void>){
 const pg=await database(),store=postgresStore(pg),s=emptyWorkspace(owner);
 s.customers.push({id:'client',name:'Fixture client',status:'active'});
 s.members.push({id:'manager',userId:manager.userId,email:manager.email,name:'Manager',role:'manager',active:true});
 await store.initialize(s);
 const save=async(record:any,projectReceipts?:any,u=owner)=>{const b=await getState(store,u,owner.email);return mutate(store,u,{action:'save',collection:'projects',record,projectReceipts,revision:b.revision},owner.email);};
 try{await run({store,save});}finally{await pg.close();}
}

test('create with deposit, complete without receipt, then collect the exact balance and persist totals',async()=>fixture(async({store,save})=>{
 let b=await save(base(),[deposit()]);const project=b.state.projects[0];
 assert.equal(b.state.payments.length,1);assert.equal(b.state.payments[0].projectId,project.id);
 assert.equal(paidProject(b.state,project.id),300000);assert.equal(metrics(b.state).deposits,300000);assert.equal(metrics(b.state).revenue,0);
 b=await save({...project,status:'completed',completedAt:today()});
 assert.equal(paidProject(b.state,project.id),300000);assert.equal(metrics(b.state).receivable,700000);assert.equal(metrics(b.state).revenue,1000000);
 b=await save({...b.state.projects[0]},[balance()]);
 assert.equal(b.state.payments.length,2);assert.equal(b.state.payments[1].amount,700000);
 assert.equal(metrics(b.state).cashIn,1000000);assert.equal(metrics(b.state).receivable,0);
 b=await save({...b.state.projects[0]},[balance()]);assert.equal(b.state.payments.length,2);
 const persisted=await getState(store,owner,owner.email);assert.equal(paidProject(persisted.state,project.id),1000000);
}));

test('invalid receipt rolls back both project and deposit, including a failure on the second receipt',async()=>fixture(async({store,save})=>{
 for(const receipts of [[deposit(1000001)],[{...deposit(),method:''}],[{...deposit(),date:'2099-01-01'}],[deposit(),{...balance(),method:''}],[deposit(),deposit()],[{kind:'other',amount:1,date:today(),method:'cash'}]]){
  const before=await store.read();
  await assert.rejects(save({...base(),status:'completed',completedAt:today()},receipts));
  assert.deepEqual(await store.read(),before);
 }
 await assert.rejects(save(base(),[balance()]),/hoàn thành/);
 await assert.rejects(save({...base(),status:'cancelled'},[deposit()]),/đã hủy/);
}));

test('new completed project records deposit and server-calculated remaining amount in one save',async()=>fixture(async({save})=>{
 const b=await save({...base(),status:'completed',completedAt:today()},[{...balance(),amount:999999999},deposit()]);
 assert.deepEqual(b.state.payments.map((p:any)=>p.amount),[300000,700000]);
 assert.equal(b.revision,1);assert.equal(metrics(b.state).cashIn,1000000);assert.equal(metrics(b.state).receivable,0);
}));

test('managers cannot create receipts, while completing an existing booking preserves the original receipts',async()=>fixture(async({store,save})=>{
 await assert.rejects(save(base(),[deposit()],manager),(e:any)=>e.status===403);
 let b=await save(base(),[deposit()]);const project=b.state.projects[0];
 await assert.rejects(save({...project,status:'completed',completedAt:today()},[balance()],manager),(e:any)=>e.status===403);
 await save({...project,status:'completed',completedAt:today(),value:0},undefined,manager);
 b=await getState(store,owner,owner.email);assert.equal(b.state.projects[0].value,1000000);assert.equal(paidProject(b.state,project.id),300000);
 await assert.rejects(save({...b.state.projects[0]},[deposit()]),/chỉ ghi khi tạo/);
}));

test('concurrent duplicate project/deposit submissions commit only one pair',async()=>fixture(async({store})=>{
 const b=await getState(store,owner,owner.email);
 const body={revision:b.revision,action:'save',collection:'projects',record:base(),projectReceipts:[deposit()]};
 const attempts=await Promise.allSettled([mutate(store,owner,structuredClone(body),owner.email),mutate(store,owner,structuredClone(body),owner.email)]);
 assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);
 assert.equal(attempts.filter(a=>a.status==='rejected'&&a.reason.status===409).length,1);
 const saved=await getState(store,owner,owner.email);assert.equal(saved.state.projects.length,1);assert.equal(saved.state.payments.length,1);
}));

test('form clearly separates received deposits and explicitly confirmed final collection',()=>{
 const draft={...emptyReceiptDraft(),depositAmount:300000,depositMethod:'bank',collectBalance:true,balanceMethod:'cash'};
 assert.deepEqual(projectReceiptRequests(draft,true,'completed').map(r=>r.kind),['deposit','balance']);
 assert.deepEqual(projectReceiptRequests(draft,false,'completed').map(r=>r.kind),['balance']);
 assert.deepEqual(projectReceiptRequests(draft,false,'confirmed'),[]);
 assert.deepEqual(projectReceiptRequests(draft,true,'cancelled'),[]);
 const html=renderToString(React.createElement(ProjectReceipts,{isNew:true,value:1000000,status:'completed',alreadyPaid:0,draft,onChange:()=>{}}));
 for(const label of ['Số tiền cọc đã nhận','Ngày nhận cọc','Hình thức nhận cọc','Khách đã thanh toán đủ phần còn lại','Ngày thu phần còn lại','700.000'])assert.ok(html.includes(label),label);
 const edit=renderToString(React.createElement(ProjectReceipts,{isNew:false,value:1000000,status:'completed',alreadyPaid:1000000,draft:emptyReceiptDraft(),onChange:()=>{}}));
 assert.ok(!edit.includes('Số tiền cọc đã nhận'));assert.ok(!edit.includes('type="checkbox"'));
});
