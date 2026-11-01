'use client';
import React from 'react';
import { ArrowUpRight, Info } from 'lucide-react';
import { metricRecords, metrics, PAYMENT_METHOD, type Collection, type Row, type Workspace } from '../lib/domain';
import { displayDay, type DateRange } from '../lib/period';

export type MetricKind = 'revenue' | 'costs' | 'profit' | 'netCash';
export const METRIC_TITLES: Record<MetricKind, string> = { revenue: 'Doanh thu ghi nhận', costs: 'Chi phí phát sinh', profit: 'Lợi nhuận quản trị', netCash: 'Dòng tiền ròng' };
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
const CATEGORY: Record<string, string> = { production: 'Sản xuất', rent: 'Mặt bằng', payroll: 'Nhân sự', equipment: 'Thiết bị', marketing: 'Marketing', other: 'Khác' };
type Section = { title: string; collection: Collection; rows: Row[]; dateKey: string; dateTitle: string; amountKey: string; subtract?: boolean };

export default function MetricDetails({ state, range, periodLabel, kind, onOpen, onClose }: {
 state: Workspace; range: DateRange; periodLabel: string; kind: MetricKind; onOpen: (collection: Collection, id: string) => void; onClose: () => void;
}) {
 const records = metricRecords(state, range), totals = metrics(state, range);
 const revenue: Section = { title: 'Dự án đã hoàn thành', collection: 'projects', rows: records.revenue, dateKey: 'completedAt', dateTitle: 'Hoàn thành', amountKey: 'value' };
 const costs: Section = { title: 'Chi phí vận hành phát sinh', collection: 'costs', rows: records.costs, dateKey: 'incurredAt', dateTitle: 'Phát sinh', amountKey: 'amount', subtract: kind === 'profit' };
 const sections: Section[] = kind === 'revenue' ? [revenue] : kind === 'costs' ? [costs] : kind === 'profit' ? [revenue, costs] : [
  { title: 'Tiền thu đã ghi nhận', collection: 'payments', rows: records.cashIn, dateKey: 'date', dateTitle: 'Ngày thu', amountKey: 'amount' },
  { title: 'Tiền chi đã ghi nhận', collection: 'payments', rows: records.cashOut, dateKey: 'date', dateTitle: 'Ngày chi', amountKey: 'amount', subtract: true }
 ];
 const note = kind === 'netCash'
  ? 'Tiền thu gồm cọc và phiếu tự động khi hoàn thành. Tiền chi gồm cả khoản đầu tư có giao dịch chi trong kỳ. Không cộng số đã trả trước khi theo dõi hoặc số dư đầu kỳ. Đây không phải lợi nhuận ròng sau thuế.'
  : kind === 'revenue' ? 'Cộng toàn bộ giá trị hợp đồng của dự án hoàn thành trong kỳ theo ngày hoàn thành. Tiền cọc của dự án chưa hoàn thành chưa được tính là doanh thu.'
  : 'Chi phí được chọn theo ngày phát sinh, kể cả khi dự án chưa hoàn thành hoặc khoản chi chưa thanh toán. Vốn đầu tư ban đầu được theo dõi riêng. Lợi nhuận quản trị chưa tính thuế, khấu hao và chi phí chưa nhập.';
 const projectName = (id: string) => state.projects.find(p => p.id === id)?.name || 'Chi phí chung';
 function context(section: Section, row: Row) {
  if (section.collection === 'projects') return (state.customers.find(c => c.id === row.clientId)?.name || '—') + ' · ' + row.service;
  if (section.collection === 'costs') return CATEGORY[row.category] + ' · ' + projectName(row.projectId);
  return (row.direction === 'in' ? projectName(row.projectId) : state.costs.find(c => c.id === row.costId)?.name || '—') + ' · ' + (PAYMENT_METHOD[row.method] || 'Chưa xác định') + (row.automaticReceipt ? ' · Thu tự động' : '');
 }
 return <>
  <div className="modal-body metric-details">
   <div className="metric-period"><span>Kỳ báo cáo</span><b>{periodLabel}</b></div>
   <div className="metric-result"><span>{METRIC_TITLES[kind]}</span><strong>{money(totals[kind])}</strong></div>
   {(kind === 'profit' || kind === 'netCash') && <div className="metric-equation">
    <div><span>{kind === 'profit' ? 'Doanh thu ghi nhận' : 'Tiền thu trong kỳ'}</span><b>{money(kind === 'profit' ? totals.revenue : totals.cashIn)}</b></div>
    <span aria-label="trừ">−</span>
    <div><span>{kind === 'profit' ? 'Chi phí vận hành' : 'Tiền chi trong kỳ'}</span><b>{money(kind === 'profit' ? totals.costs : totals.cashOut)}</b></div>
   </div>}
   <div className="notice metric-method"><Info size={17} /><span>{note}</span></div>
   <p className="metric-instruction">Bấm vào tên để mở dự án, chi phí hoặc giao dịch gốc.</p>
   {sections.map(section => {
    const total = section.rows.reduce((sum, row) => sum + (row[section.amountKey] || 0), 0);
    return <section className="metric-section" key={section.title}>
     <div className="metric-section-head"><h3>{section.title}<small>{section.rows.length} bản ghi</small></h3><strong>{section.subtract ? '−' : ''}{money(total)}</strong></div>
     {section.rows.length ? <div className="table-wrap"><table><thead><tr><th>Nội dung</th><th>{section.dateTitle}</th><th className="right">Số tiền</th></tr></thead><tbody>
      {[...section.rows].sort((a, b) => b[section.dateKey].localeCompare(a[section.dateKey])).map(row => <tr key={row.id}><td><button type="button" className="metric-record-link" onClick={() => onOpen(section.collection, row.id)}>{row.name}<ArrowUpRight size={15} /></button><small>{context(section, row)}</small></td><td data-label={section.dateTitle}>{displayDay(row[section.dateKey])}</td><td className="right amount">{section.subtract ? '−' : ''}{money(row[section.amountKey])}</td></tr>)}
     </tbody><tfoot><tr><th colSpan={2}>Tổng {section.rows.length} bản ghi</th><th className="right">{section.subtract ? '−' : ''}{money(total)}</th></tr></tfoot></table></div> : <p className="metric-empty">Không có khoản nào trong kỳ đã chọn.</p>}
    </section>;
   })}
  </div>
  <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Đóng chi tiết</button></div>
 </>;
}
