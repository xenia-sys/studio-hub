import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import StudioApp from '../app/StudioApp';
import { emptyWorkspace, normalize, paidCost, metrics, today } from '../lib/domain.ts';
import { database, postgresStore } from './helpers';
import { getState, mutate } from '../lib/service.ts';

const owner={userId:'capital-owner',email:'capital@studio.test',displayName:'Owner'};
test('settled initial investment clears debt without invented cash payments or an operating loss',()=>{
 const s=emptyWorkspace(owner);
 const capital=normalize(s,'costs',{id:'',name:'Vốn ban đầu',amount:1000000,costKind:'initial_capital',openingPaidAmount:1000000,category:'equipment',incurredAt:today()});
 s.costs.push(capital);
 s.costs.push(normalize(s,'costs',{id:'',name:'Vận hành',amount:1000,category:'other',incurredAt:today()}));
 const m=metrics(s,today().slice(0,7));
 assert.equal(m.initialInvestment,1000000);assert.equal(m.openingPaid,1000000);
 assert.equal(m.costs,1000);assert.equal(m.profit,-1000);assert.equal(m.payable,1000);
 assert.equal(paidCost(s,capital.id),capital.amount);assert.equal(m.cashOut,0);assert.equal(s.payments.length,0);
 assert.equal(metrics(s,'1999-01').initialInvestment,0);
 assert.throws(()=>normalize(s,'payments',{id:'',name:'Double pay',direction:'out',amount:1,costId:capital.id,date:today(),method:'bank'}),/vượt/);
 assert.throws(()=>normalize(s,'costs',{...capital,costKind:'operating'},capital),/vốn đầu tư/);
 assert.throws(()=>normalize(s,'costs',{...capital,openingPaidAmount:capital.amount+1},capital),/thấp hơn/);
 const edit=normalize(s,'costs',{id:capital.id,name:'Đổi tên',amount:capital.amount,category:capital.category,incurredAt:today()},capital);
 assert.equal(edit.costKind,'initial_capital');assert.equal(edit.openingPaidAmount,capital.amount);
 const html=renderToString(React.createElement(StudioApp,{initialData:{state:s,me:s.members[0],revision:1},initialView:'finance'}));
 assert.ok(html.includes('Vốn đầu tư ban đầu:'));assert.ok(html.includes('1.000.000'));
 assert.ok(html.includes('Đã trả trước khi theo dõi'));assert.ok(!html.includes('NaN'));
});

test('opening payment survives persistence and later real payments cannot exceed the remaining balance',async()=>{
 const pg=await database();const db=postgresStore(pg);
 try{
  await db.initialize(emptyWorkspace(owner));
  const action=async(collection:string,record:any)=>{const b=await getState(db,owner,owner.email);return mutate(db,owner,{action:'save',collection,record,revision:b.revision},owner.email);};
  let b=await action('costs',{id:'',name:'Thiết bị cũ',amount:100000,costKind:'initial_capital',openingPaidAmount:60000,category:'equipment',incurredAt:today()});
  const c=b.state.costs[0];assert.equal(metrics(b.state).payable,40000);
  b=await action('payments',{id:'',name:'Trả phần còn lại',direction:'out',amount:40000,costId:c.id,date:today(),method:'cash'});
  assert.equal(metrics(b.state).payable,0);assert.equal(metrics(b.state).cashOut,40000);assert.equal(metrics(b.state).costs,0);
  await assert.rejects(action('payments',{id:'',name:'Trả trùng',direction:'out',amount:1,costId:c.id,date:today(),method:'bank'}),/vượt/);
  await assert.rejects(action('costs',{...c,amount:99999}),/thấp hơn/);
  const persisted=await getState(db,owner,owner.email);assert.equal(paidCost(persisted.state,c.id),100000);assert.equal(persisted.state.payments.length,1);
 }finally{await pg.close();}
});
