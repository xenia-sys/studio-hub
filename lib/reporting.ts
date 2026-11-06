import { metricRecords, type Workspace } from './domain.ts';
import { displayDay, inPeriod, projectBookingDate, type DateRange } from './period.ts';

const DAY = 86400000;
const stamp = (day: string) => new Date(day + 'T00:00:00Z').getTime();
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
export function financeBalances(state: Workspace, range: DateRange) {
 const received = new Map<string, number>(), paid = new Map<string, number>();
 for (const payment of state.payments) {
  const map = payment.direction === 'in' ? received : paid;
  const key = payment.direction === 'in' ? payment.projectId : payment.costId;
  map.set(key, (map.get(key) || 0) + payment.amount);
 }
 const receivables = state.projects.filter(p => p.status === 'completed' && inPeriod(p.completedAt, range)).map(project => ({ project, remaining: Math.max(0, project.value - (received.get(project.id) || 0)) })).filter(row => row.remaining > 0);
 const payables = state.costs.filter(c => inPeriod(c.incurredAt, range)).map(cost => ({ cost, remaining: Math.max(0, cost.amount - (cost.openingPaidAmount || 0) - (paid.get(cost.id) || 0)) })).filter(row => row.remaining > 0);
 const deposits = state.projects.filter(p => !['completed', 'cancelled'].includes(p.status) && inPeriod(projectBookingDate(p), range)).reduce((sum, p) => sum + (received.get(p.id) || 0), 0);
 return { receivables, payables, deposits, receivable: receivables.reduce((sum, row) => sum + row.remaining, 0), payable: payables.reduce((sum, row) => sum + row.remaining, 0) };
}
export function reportSeries(state: Workspace, range: DateRange, fallbackDay: string) {
 const records = metricRecords(state, range);
 const dates = [...records.revenue.map(p => p.completedAt as string), ...records.costs.map(c => c.incurredAt as string)].filter(Boolean).sort();
 const from = range.from || dates[0] || fallbackDay, to = range.to || dates.at(-1) || fallbackDay;
 const days = Math.round((stamp(to) - stamp(from)) / DAY) + 1;
 const unit = days <= 14 ? 'day' : days <= 62 ? 'week' : days <= 730 ? 'month' : 'year';
 const buckets: { from: string; to: string; label: string; revenue: number; costs: number }[] = [];
 let cursor = from;
 const yearStep = Math.max(1, Math.ceil((Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1) / 12));
 while (cursor <= to && buckets.length < 30) {
  let end: string;
  if (unit === 'day' || unit === 'week') end = iso(stamp(cursor) + (unit === 'day' ? 0 : 6) * DAY);
  else if (unit === 'month') {
   const date = new Date(cursor + 'T00:00:00Z'); date.setUTCMonth(date.getUTCMonth() + 1, 0); end = iso(date.getTime());
  } else end = Math.min(9999, Number(cursor.slice(0, 4)) + yearStep - 1) + '-12-31';
  if (end > to) end = to;
  const period = { from: cursor, to: end };
  buckets.push({ ...period, label: unit === 'month' ? cursor.slice(5, 7) + '/' + cursor.slice(2, 4) : unit === 'year' ? cursor.slice(0, 4) : displayDay(cursor).slice(0, 5),
   revenue: records.revenue.filter(p => inPeriod(p.completedAt, period)).reduce((sum, p) => sum + p.value, 0),
   costs: records.costs.filter(c => inPeriod(c.incurredAt, period)).reduce((sum, c) => sum + c.amount, 0) });
  if (end === to) break;
  cursor = iso(stamp(end) + DAY);
 }
 return { unit, buckets };
}
