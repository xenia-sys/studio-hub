import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { emptyWorkspace, metrics, metricRecords, type Workspace } from '../lib/domain.ts';
import { defaultPeriod, periodRange, periodLabel, inPeriod, type DateRange } from '../lib/period.ts';
import { financeBalances, reportSeries } from '../lib/reporting.ts';
import DateFilter from '../app/DateFilter';
import MetricDetails, { type MetricKind } from '../app/MetricDetails';

const owner = { userId: 'report-owner', email: 'report@studio.test', displayName: 'Report Owner' };
function fixture(): Workspace {
 const state = emptyWorkspace(owner);
 state.customers = [{ id: 'client', name: 'Test Client' }];
 state.projects = [
  { id: 'oct', name: 'October project', value: 10000, status: 'completed', completedAt: '2026-10-31', start: '2026-10-30' },
  { id: 'nov', name: 'November project', value: 20000, status: 'completed', completedAt: '2026-11-01', start: '2026-11-01' },
  { id: 'later', name: 'Later project', value: 30000, status: 'completed', completedAt: '2026-11-02', start: '2026-11-02' },
  { id: 'active', name: 'Deposit project', value: 40000, status: 'ongoing', completedAt: '', start: '2026-11-01' }
 ].map(p => ({ ...p, due: p.start, clientId: 'client', service: 'Nhiếp ảnh' }));
 state.costs = [
  { id: 'cost-oct', name: 'October cost', amount: 3000, incurredAt: '2026-10-31' },
  { id: 'cost-nov', name: 'November cost', amount: 5000, incurredAt: '2026-11-01' },
  { id: 'cost-later', name: 'Later cost', amount: 7000, incurredAt: '2026-11-02' },
  { id: 'capital', name: 'Initial equipment', amount: 100000, incurredAt: '2026-11-01', costKind: 'initial_capital', openingPaidAmount: 100000 }
 ].map(c => ({ ...c, category: 'equipment' }));
 state.payments = [
  { id: 'receipt-oct', name: 'Old receipt', direction: 'in', amount: 10000, date: '2026-10-01', projectId: 'oct' },
  { id: 'receipt-nov', name: 'Later receipt', direction: 'in', amount: 20000, date: '2026-11-02', projectId: 'nov' },
  { id: 'deposit', name: 'Received deposit', direction: 'in', amount: 2000, date: '2026-11-01', projectId: 'active' },
  { id: 'pay-oct', name: 'Later payment', direction: 'out', amount: 3000, date: '2026-11-03', costId: 'cost-oct' },
  { id: 'pay-early', name: 'Early payment', direction: 'out', amount: 1000, date: '2026-10-30', costId: 'cost-nov' },
  { id: 'pay-now', name: 'Current payment', direction: 'out', amount: 2000, date: '2026-11-01', costId: 'cost-nov' }
 ].map(p => ({ ...p, method: 'bank' }));
 return state;
}
const range = { from: '2026-10-31', to: '2026-11-01' };

test('period controls resolve days, months including leap years, years, and inclusive ranges', () => {
 const selection = defaultPeriod('2026-11-01');
 assert.deepEqual(periodRange(selection), { from: '2026-11-01', to: '2026-11-30' });
 assert.deepEqual(periodRange({ ...selection, mode: 'month', month: '2024-02' }), { from: '2024-02-01', to: '2024-02-29' });
 assert.deepEqual(periodRange({ ...selection, mode: 'year' }), { from: '2026-01-01', to: '2026-12-31' });
 assert.deepEqual(periodRange({ ...selection, mode: 'day' }), { from: '2026-11-01', to: '2026-11-01' });
 assert.deepEqual(periodRange({ ...selection, mode: 'range', ...range }), range);
 assert.deepEqual(periodRange({ ...selection, mode: 'all' }), { from: '', to: '' });
 for (const day of ['2026-10-31', '2026-11-01']) assert.equal(inPeriod(day, range), true);
 for (const day of ['2026-10-30', '2026-11-02', '', undefined]) assert.equal(inPeriod(day, range), false);
 assert.equal(inPeriod(undefined, { from: '', to: '' }), true);
 assert.equal(periodLabel({ ...selection, mode: 'range', ...range }), '31/10/2026 – 01/11/2026');
});

test('invalid dates and reversed ranges cannot replace the applied report period', () => {
 const selection = defaultPeriod('2026-11-01');
 for (const patch of [{ mode: 'range', from: '2026-11-02', to: '2026-11-01' }, { mode: 'range', from: '', to: '2026-11-01' }, { mode: 'day', day: '2026-02-30' }, { mode: 'month', month: '2026-13' }, { mode: 'year', year: '26' }]) {
  assert.throws(() => periodRange({ ...selection, ...patch } as any));
 }
});

test('financial totals and detail rows use each record date, including both range boundaries', () => {
 const state = fixture(), before = structuredClone(state), result = metrics(state, range), rows = metricRecords(state, range);
 assert.deepEqual([result.revenue, result.costs, result.profit, result.cashIn, result.cashOut, result.netCash, result.initialInvestment], [30000, 8000, 22000, 2000, 2000, 0, 100000]);
 assert.deepEqual(rows.revenue.map(p => p.id), ['oct', 'nov']);
 assert.deepEqual(rows.costs.map(c => c.id), ['cost-oct', 'cost-nov']);
 assert.deepEqual(rows.cashIn.map(p => p.id), ['deposit']);
 assert.equal(metrics(state, '2026-11').revenue, metrics(state, periodRange(defaultPeriod('2026-11-01'))).revenue);
 assert.equal(metrics(state, { from: '2025-01-01', to: '2025-12-31' }).revenue, 0);
 assert.deepEqual(state, before);
});

test('period debt balances use all linked payments, including payments outside the chosen period', () => {
 const state = fixture(), result = financeBalances(state, range);
 assert.equal(result.receivable, 0);
 assert.equal(result.payable, 2000);
 assert.equal(result.deposits, 2000);
 assert.deepEqual(result.payables.map(row => row.cost.id), ['cost-nov']);
 const all = financeBalances(state, { from: '', to: '' });
 assert.equal(all.receivable, metrics(state).receivable);
 assert.equal(all.payable, metrics(state).payable);
 assert.equal(all.deposits, metrics(state).deposits);
});

test('chart buckets reconcile to report totals without including out-of-range activity', () => {
 const state = fixture();
 for (const period of [range, { from: '', to: '' }, { from: '2026-11-01', to: '2026-11-01' }, { from: '2026-01-01', to: '2026-12-31' }, { from: '2000-01-01', to: '2040-12-31' }]) {
  const series = reportSeries(state, period, '2026-11-01'), result = metrics(state, period);
  assert.equal(series.buckets.reduce((sum, row) => sum + row.revenue, 0), result.revenue);
  assert.equal(series.buckets.reduce((sum, row) => sum + row.costs, 0), result.costs);
  for (let i = 1; i < series.buckets.length; i++) assert.ok(series.buckets[i - 1].to < series.buckets[i].from);
 }
 assert.equal(reportSeries(emptyWorkspace(owner), { from: '', to: '' }, '2026-11-01').buckets.length, 1);
});

test('each financial drilldown shows its formula, exact total, matching records and original-record buttons', () => {
 const state = fixture(), options: Record<MetricKind, string[]> = {
  revenue: ['30.000', 'October project', 'November project', 'Hoàn thành'],
  costs: ['8.000', 'October cost', 'November cost', 'Phát sinh'],
  profit: ['22.000', '30.000', '8.000', 'Dự án đã hoàn thành', 'Chi phí vận hành phát sinh'],
  netCash: ['Received deposit', 'Current payment', 'Tiền thu trong kỳ', 'Tiền chi trong kỳ', 'không phải lợi nhuận ròng sau thuế']
 };
 for (const [kind, expected] of Object.entries(options)) {
  const html = renderToString(React.createElement(MetricDetails, { state, range, periodLabel: '31/10/2026 – 01/11/2026', kind: kind as MetricKind, onOpen: () => {}, onClose: () => {} }));
  for (const label of expected) assert.ok(html.includes(label), kind + ': ' + label);
  for (const excluded of ['Later project', 'Later cost', 'Later receipt', 'Old receipt', 'Initial equipment']) assert.ok(!html.includes(excluded), kind + ' excludes ' + excluded);
  assert.ok(html.includes('metric-record-link'));
 }
});

test('date filter exposes explicit apply, quick shortcuts and distinct day/month/year/range inputs', () => {
 for (const mode of ['day', 'month', 'year', 'range', 'all'] as const) {
  const html = renderToString(React.createElement(DateFilter, { value: defaultPeriod('2026-11-01', mode), today: '2026-11-01', help: 'Chi phí theo ngày phát sinh', onChange: () => {} }));
  for (const label of ['Hôm nay', 'Tháng này', 'Năm nay', 'Toàn bộ', 'Áp dụng', 'Đang xem:']) assert.ok(html.includes(label));
  if (mode === 'range') for (const label of ['Từ ngày', 'Đến ngày']) assert.ok(html.includes(label));
  assert.ok(html.includes('Chi phí theo ngày phát sinh'));
 }
});
