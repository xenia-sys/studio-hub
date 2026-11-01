'use client';
import React, { useState } from 'react';
import { CalendarDays, Check, RotateCcw } from 'lucide-react';
import { defaultPeriod, periodLabel, periodRange, type PeriodMode, type PeriodSelection } from '../lib/period';

const MODES: Record<PeriodMode, string> = { day: 'Theo ngày', month: 'Theo tháng', year: 'Theo năm', range: 'Từ ngày – đến ngày', all: 'Toàn bộ thời gian' };
export default function DateFilter({ value, today, onChange, help, children, extraDirty = false }: {
 value: PeriodSelection; today: string; onChange: (value: PeriodSelection) => void; help: string; children?: React.ReactNode; extraDirty?: boolean;
}) {
 const [draft, setDraft] = useState(value), [error, setError] = useState('');
 const dirty = extraDirty || JSON.stringify(draft) !== JSON.stringify(value);
 function apply(next: PeriodSelection) {
  try { periodRange(next); setError(''); setDraft(next); onChange(next); }
  catch (error) { setError((error as Error).message); }
 }
 function change(patch: Partial<PeriodSelection>) { setDraft({ ...draft, ...patch }); setError(''); }
 return <section className="date-filter" aria-label="Bộ lọc thời gian">
  <div className="date-filter-heading"><span><CalendarDays size={18} />Thời gian</span><div className="date-shortcuts">
   {([{ label: 'Hôm nay', mode: 'day' }, { label: 'Tháng này', mode: 'month' }, { label: 'Năm nay', mode: 'year' }] as const).map(item => <button type="button" key={item.mode} onClick={() => apply(defaultPeriod(today, item.mode))}>{item.label}</button>)}
   <button type="button" onClick={() => apply(defaultPeriod(today, 'all'))}><RotateCcw size={13} />Toàn bộ</button>
  </div></div>
  <form className="date-filter-controls" onSubmit={e => { e.preventDefault(); apply(draft); }}>
   <label><span>Chế độ lọc</span><select value={draft.mode} onChange={e => change({ mode: e.target.value as PeriodMode })}>{Object.entries(MODES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
   {draft.mode === 'day' && <label><span>Ngày</span><input type="date" required value={draft.day} onChange={e => change({ day: e.target.value })} /></label>}
   {draft.mode === 'month' && <label><span>Tháng</span><input type="month" required value={draft.month} onChange={e => change({ month: e.target.value })} /></label>}
   {draft.mode === 'year' && <label><span>Năm</span><input type="number" required min={1000} max={9999} step={1} value={draft.year} onChange={e => change({ year: e.target.value })} /></label>}
   {draft.mode === 'range' && <><label><span>Từ ngày</span><input type="date" required value={draft.from} onChange={e => change({ from: e.target.value })} /></label><label><span>Đến ngày</span><input type="date" required value={draft.to} onChange={e => change({ to: e.target.value })} /></label></>}
   {children}
   <button type="submit" className="button"><Check size={16} />Áp dụng</button>
  </form>
  {error && <p className="date-filter-error" role="alert">{error}</p>}
  <p className="date-filter-summary" role="status"><b>Đang xem: {periodLabel(value)}</b>{dirty && <span className="pending-filter">Có thay đổi chưa áp dụng</span>}</p>
  <p className="date-filter-help">{help}</p>
 </section>;
}
