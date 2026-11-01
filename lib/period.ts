export type DateRange = { from: string; to: string };
export type PeriodMode = 'all' | 'day' | 'month' | 'year' | 'range';
export type PeriodSelection = { mode: PeriodMode; day: string; month: string; year: string; from: string; to: string };
export type Period = string | DateRange;
export type ProjectDateField = 'start' | 'due' | 'completedAt';
export const PROJECT_DATE_FIELDS: Record<ProjectDateField, string> = { start: 'Ngày bắt đầu / booking', due: 'Hạn bàn giao', completedAt: 'Ngày hoàn thành' };

export function defaultPeriod(day: string, mode: PeriodMode = 'month'): PeriodSelection {
 return { mode, day, month: day.slice(0, 7), year: day.slice(0, 4), from: day.slice(0, 7) + '-01', to: day };
}
function validDay(value: string) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const date = new Date(value + 'T00:00:00Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function periodRange(selection: PeriodSelection): DateRange {
 switch (selection.mode) {
  case 'all': return { from: '', to: '' };
  case 'day':
   if (!validDay(selection.day)) throw new Error('Chọn một ngày hợp lệ.');
   return { from: selection.day, to: selection.day };
  case 'month': {
   if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selection.month)) throw new Error('Chọn một tháng hợp lệ.');
   const from = selection.month + '-01';
   const date = new Date(from + 'T00:00:00Z');
   date.setUTCMonth(date.getUTCMonth() + 1, 0);
   return { from, to: date.toISOString().slice(0, 10) };
  }
  case 'year':
   if (!/^[1-9]\d{3}$/.test(selection.year)) throw new Error('Nhập năm gồm 4 chữ số, từ 1000 đến 9999.');
   return { from: selection.year + '-01-01', to: selection.year + '-12-31' };
  case 'range':
   if (!validDay(selection.from) || !validDay(selection.to)) throw new Error('Chọn đủ Từ ngày và Đến ngày hợp lệ.');
   if (selection.from > selection.to) throw new Error('Từ ngày phải trước hoặc bằng Đến ngày.');
   return { from: selection.from, to: selection.to };
 }
}
export function inPeriod(day: string | undefined, period: Period = '') {
 if (typeof period === 'string') return !period || !!day?.startsWith(period);
 if (!period.from && !period.to) return true;
 return !!day && (!period.from || day >= period.from) && (!period.to || day <= period.to);
}
export const displayDay = (day: string) => day.split('-').reverse().join('/');
export function periodLabel(selection: PeriodSelection) {
 switch (selection.mode) {
  case 'all': return 'Toàn bộ thời gian';
  case 'day': return 'Ngày ' + displayDay(selection.day);
  case 'month': return 'Tháng ' + selection.month.slice(5) + '/' + selection.month.slice(0, 4);
  case 'year': return 'Năm ' + selection.year;
  case 'range': return displayDay(selection.from) + ' – ' + displayDay(selection.to);
 }
}
