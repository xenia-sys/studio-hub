import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import StudioApp from '../app/StudioApp';
import { demoWorkspace } from '../lib/demo.ts';
import { today, visibleState } from '../lib/domain.ts';
import { calendarDay } from '../lib/booking-calendar.ts';
const state=demoWorkspace({userId:'owner',email:'owner@studio.test',displayName:'Test Owner'});
const data={state,me:state.members[0],revision:0};
test('all 6 application views render with the expected records and controls',()=>{
 const checks={dashboard:['Doanh thu ghi nhận','9,5 tr','Tạo mới'],customers:['Khách hàng &amp; mối quan hệ','Linen Atelier','Thêm khách hàng'],projects:['Dự án &amp; booking','Linen / Lookbook vol.02','Thêm dự án'],staff:['Những người tạo nên studio','Minh Anh','Thêm nhân sự'],finance:['Tài chính rõ ràng hơn','Đặt cọc đang giữ','Crew lookbook'],settings:['Hồ sơ vận hành','Ma trận quyền','Xuất JSON']};
 for(const [view,strings]of Object.entries(checks)){const html=renderToString(React.createElement(StudioApp,{initialData:data,initialView:view})).replace(/<!--.*?-->/g,'');for(const value of strings)assert.ok(html.includes(value),view+': '+value);assert.ok(!html.includes('NaN'));}
});
test('manager UI and server-filtered data do not disclose contract or financial records',()=>{
 const member:any={id:'manager',name:'Test Manager',email:'manager@studio.test',role:'manager',active:true,userId:'manager'};
 const safe={state:visibleState(state,member),me:member,revision:0};
 const dashboard=renderToString(React.createElement(StudioApp,{initialData:safe}));assert.ok(!dashboard.includes('Doanh thu ghi nhận'));assert.ok(!dashboard.includes('9,5 tr'));assert.ok(dashboard.includes('Dự án đang triển khai'));
 const projects=renderToString(React.createElement(StudioApp,{initialData:safe,initialView:'projects'}));assert.ok(!projects.includes('28.000.000'));assert.ok(!projects.includes('Hợp đồng'));
});
test('viewer UI omits write controls',()=>{
 const member:any={id:'viewer',name:'Test Viewer',email:'viewer@studio.test',role:'viewer',active:true,userId:'viewer'};
 const safe={state:visibleState(state,member),me:member,revision:0};
 for(const view of ['dashboard','customers','projects','staff']){const html=renderToString(React.createElement(StudioApp,{initialData:safe,initialView:view}));assert.ok(!html.includes('Tạo mới'));assert.ok(!html.includes('Thêm khách hàng'));assert.ok(!html.includes('Thêm dự án'));assert.ok(!html.includes('Thêm nhân sự'));}
});
test('the project calendar renders the supplied workspace booking with its original hours',()=>{
 const booking={...state.projects[0],id:'calendar-entry',name:'Booking trong workspace',status:'confirmed',start:calendarDay(today(),-14),bookingDate:today(),startTime:'07:00',endTime:'09:00'};
 const cancelled={...booking,id:'cancelled-entry',name:'Lịch đã hủy',status:'cancelled'};
 const input={...data,state:{...state,demoLoaded:false,projects:[booking,cancelled]}};
 const html=renderToString(React.createElement(StudioApp,{initialData:input,initialView:'projects'})).split('Danh sách dự án')[0];
 assert.match(html,/Lịch booking/);
 assert.match(html,/Xem dự án Booking trong workspace · 07:00–09:00/);
 assert.doesNotMatch(html,/Lịch đã hủy/);
});
