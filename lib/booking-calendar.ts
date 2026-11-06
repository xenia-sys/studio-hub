import type { Row } from './domain.ts';

export type CalendarView = 'day' | 'week' | 'month';
export type CalendarProject = { id: string; name: string; status: string; resource: string };
export type CalendarBooking = CalendarProject & { from: number; to: number };
type Interval = { from: number; to: number };
export type AvailabilitySegment = Interval & { tone: 'free' | 'booked' | 'unknown' };
type DayBookings = { bookings: CalendarBooking[]; untimed: CalendarProject[] };
export type BookingIndex = { days: Map<string, DayBookings>; undated: CalendarProject[] };

export const BOOKING_HOURS = { from: 8 * 60, to: 20 * 60 } as const;
const dateAt = (day: string) => new Date(day + 'T00:00:00Z');
const iso = (date: Date) => date.toISOString().slice(0, 10);
const pad = (value: number) => String(value).padStart(2, '0');
export const bookingClock = (minute: number) => pad(Math.floor(minute / 60)) + ':' + pad(minute % 60);
export const bookingDuration = (minutes: number) => {
 const hours = Math.floor(minutes / 60), remainder = minutes % 60;
 return hours ? hours + 'h' + (remainder ? pad(remainder) : '') : remainder + ' phút';
};

function validDate(day: unknown): day is string {
 if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
 const date = dateAt(day);
 return Number.isFinite(date.getTime()) && iso(date) === day;
}
function timeMinutes(time: unknown): number | null {
 if (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
 return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}
export function calendarDay(day: string, step: number) {
 const date = dateAt(day);
 date.setUTCDate(date.getUTCDate() + step);
 return iso(date);
}
export function calendarWeek(day: string) {
 const first = calendarDay(day, -((dateAt(day).getUTCDay() + 6) % 7));
 return Array.from({ length: 7 }, (_, offset) => calendarDay(first, offset));
}
export function calendarMonth(day: string) {
 const first = day.slice(0, 7) + '-01';
 const gridStart = calendarWeek(first)[0];
 const last = dateAt(first);
 last.setUTCMonth(last.getUTCMonth() + 1, 0);
 const offset = (dateAt(first).getUTCDay() + 6) % 7;
 return Array.from({ length: 7 * Math.ceil((offset + last.getUTCDate()) / 7) }, (_, n) => calendarDay(gridStart, n));
}
export function shiftCalendar(day: string, view: CalendarView, step: -1 | 1) {
 if (view !== 'month') return calendarDay(day, step * (view === 'week' ? 7 : 1));
 const next = dateAt(day.slice(0, 7) + '-01');
 next.setUTCMonth(next.getUTCMonth() + step);
 const last = new Date(next);
 last.setUTCMonth(last.getUTCMonth() + 1, 0);
 next.setUTCDate(Math.min(Number(day.slice(8)), last.getUTCDate()));
 return iso(next);
}

export function indexBookings(projects: readonly Row[]): BookingIndex {
 const days = new Map<string, DayBookings>(), undated: CalendarProject[] = [];
 for (const row of projects) {
  if (row.status === 'cancelled') continue;
  const project: CalendarProject = { id: row.id, name: row.name, status: row.status, resource: row.resource || '' };
  if (!validDate(row.start)) {
   undated.push(project);
   continue;
  }
  const day = days.get(row.start) ?? { bookings: [], untimed: [] };
  const from = timeMinutes(row.startTime), to = timeMinutes(row.endTime);
  if (from === null || to === null || to <= from) day.untimed.push(project);
  else day.bookings.push({ ...project, from, to });
  days.set(row.start, day);
 }
 for (const day of days.values()) day.bookings.sort((a, b) => a.from - b.from || a.to - b.to || a.id.localeCompare(b.id));
 return { days, undated };
}

export function bookingDay(index: BookingIndex, date: string) {
 const { bookings, untimed } = index.days.get(date) ?? { bookings: [], untimed: [] };
 const segments: AvailabilitySegment[] = [];
 let cursor: number = BOOKING_HOURS.from;
 const gapTone = untimed.length ? 'unknown' : 'free';
 let openMinutes = 0;
 function gap(to: number) {
  if (to <= cursor) return;
  segments.push({ from: cursor, to, tone: gapTone });
  openMinutes += to - cursor;
  cursor = to;
 }
 for (const booking of bookings) {
  const from = Math.max(BOOKING_HOURS.from, booking.from), to = Math.min(BOOKING_HOURS.to, booking.to);
  if (to <= from || to <= cursor) continue;
  gap(from);
  const previous = segments.at(-1);
  if (previous?.tone === 'booked' && previous.to === cursor) previous.to = to;
  else segments.push({ from: cursor, to, tone: 'booked' });
  cursor = to;
 }
 gap(BOOKING_HOURS.to);
 return { date, bookings, untimed, segments, openMinutes, availabilityKnown: !untimed.length || openMinutes === 0 };
}
export type BookingDay = ReturnType<typeof bookingDay>;

export function bookingWindow(days: readonly BookingDay[]): Interval {
 let from: number = BOOKING_HOURS.from, to: number = BOOKING_HOURS.to;
 for (const day of days) for (const booking of day.bookings) {
  from = Math.min(from, Math.floor(booking.from / 60) * 60);
  to = Math.max(to, Math.ceil(booking.to / 60) * 60);
 }
 return { from, to };
}

// Share a column only for bookings whose time spans overlap. Adjacent spans can reuse a lane.
export function bookingLanes(bookings: readonly CalendarBooking[]) {
 const placed: { booking: CalendarBooking; lane: number; lanes: number }[] = [];
 let endByLane: number[] = [], groupStart = 0, groupEnd = 0;
 function finishGroup() {
  for (let i = groupStart; i < placed.length; i++) placed[i].lanes = endByLane.length;
 }
 for (const booking of bookings) {
  if (booking.from >= groupEnd) {
   finishGroup();
   endByLane = [];
   groupStart = placed.length;
  }
  let lane = endByLane.findIndex(end => end <= booking.from);
  if (lane < 0) lane = endByLane.length;
  endByLane[lane] = booking.to;
  groupEnd = Math.max(groupEnd, booking.to);
  placed.push({ booking, lane, lanes: 1 });
 }
 finishGroup();
 return placed;
}
