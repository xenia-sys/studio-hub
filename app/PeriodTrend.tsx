import React from 'react';
import { type Workspace } from '../lib/domain';
import { reportSeries } from '../lib/reporting';
import { displayDay, type DateRange } from '../lib/period';
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
export default function PeriodTrend({ state, range, today }: { state: Workspace; range: DateRange; today: string }) {
 const { buckets } = reportSeries(state, range, today);
 const max = Math.max(1, ...buckets.flatMap(x => [x.revenue, x.costs]));
 const upper = Math.max(1, Math.ceil(max / 1e6));
 return <div className="trend-scroll"><div className="chart period-chart" style={{ minWidth: Math.max(340, buckets.length * 48) }} role="img" aria-label={'Doanh thu và chi phí trong kỳ: ' + buckets.map(x => displayDay(x.from) + ' đến ' + displayDay(x.to) + ': doanh thu ' + money(x.revenue) + ', chi phí ' + money(x.costs)).join('; ')}>
  <div className="y-axis">{[1, .75, .5, .25, 0].map(n => <span key={n}>{(upper * n).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</span>)}</div>
  <div className="plot"><div className="grid-lines">{[1, 2, 3, 4, 5].map(x => <i key={x} />)}</div><div className="bar-groups">{buckets.map(x => <div className="bar-group" key={x.from}>
   <div className="bars"><div className="chart-bar revenue" style={{ height: x.revenue / (upper * 1e6) * 100 + '%' }} title={displayDay(x.from) + ' – ' + displayDay(x.to) + ': ' + money(x.revenue)} /><div className="chart-bar cost" style={{ height: x.costs / (upper * 1e6) * 100 + '%' }} title={displayDay(x.from) + ' – ' + displayDay(x.to) + ': ' + money(x.costs)} /></div><span>{x.label}</span>
  </div>)}</div></div>
 </div></div>;
}
