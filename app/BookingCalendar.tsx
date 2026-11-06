'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { PROJECT_STATUS, type Row } from '../lib/domain';
import { displayDay } from '../lib/period';
import {
 BOOKING_HOURS, bookingClock, bookingDay, bookingDuration, bookingLanes, bookingWindow,
 calendarMonth, calendarWeek, indexBookings, shiftCalendar, type BookingDay, type CalendarBooking, type CalendarProject, type CalendarView
} from '../lib/booking-calendar';

const VIEWS = [{ id: 'day', label: 'Ngày' }, { id: 'week', label: 'Tuần' }, { id: 'month', label: 'Tháng' }] as const;
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const LONG_WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const shortDate = (date: string) => date.slice(8, 10) + '/' + date.slice(5, 7);
const dateName = (date: string) => LONG_WEEKDAYS[new Date(date + 'T00:00:00Z').getUTCDay()] + ', ' + displayDay(date);
const timeRange = (from: number, to: number) => bookingClock(from) + '–' + bookingClock(to);
const availability = (day: BookingDay) => !day.availabilityKnown ? 'Chưa rõ giờ' : day.openMinutes ? bookingDuration(day.openMinutes) + ' trống' : 'Kín lịch';
const summaryClass = (day: BookingDay) => !day.availabilityKnown ? 'booking-unknown-text' : day.openMinutes ? 'booking-free-text' : 'booking-full-text';
const bookingLabel = (booking: CalendarBooking) => booking.name + ' · ' + timeRange(booking.from, booking.to) + ' · ' + (PROJECT_STATUS[booking.status] || booking.status) + (booking.resource ? ' · ' + booking.resource : '');

function AvailabilityBar({ day }: { day: BookingDay }) {
 return <div className="booking-availability-bar" aria-hidden="true">
  {day.segments.map(s => <span key={s.from} className={'booking-tone-' + s.tone} style={{ flexGrow: s.to - s.from }} />)}
 </div>;
}

function BookingButton({ booking, onOpen }: { booking: CalendarBooking; onOpen: (id: string) => void }) {
 return <button type="button" className="booking-interval booking-tone-booked" onClick={() => onOpen(booking.id)} aria-label={'Xem dự án ' + bookingLabel(booking)}>
  <span className="booking-time">{timeRange(booking.from, booking.to)}</span>
  <span className="booking-interval-name"><b>{booking.name}</b><small>{PROJECT_STATUS[booking.status] || booking.status}{booking.resource && ' · ' + booking.resource}</small></span>
  <ArrowUpRight size={16} aria-hidden="true" />
 </button>;
}

function UnscheduledProjects({ projects, heading, onOpen }: { projects: CalendarProject[]; heading: string; onOpen: (id: string) => void }) {
 return <details className="booking-unscheduled">
  <summary>{heading}</summary>
  <div>{projects.map(project => <button key={project.id} type="button" className="text-button" onClick={() => onOpen(project.id)}>
   {project.name}<ArrowUpRight size={15} aria-hidden="true" />
  </button>)}</div>
 </details>;
}

function DaySchedule({ day, onOpen }: { day: BookingDay; onOpen: (id: string) => void }) {
 const rows = [
  ...day.bookings.map(booking => ({ from: booking.from, kind: 'booking', booking } as const)),
  ...day.segments.filter(slot => slot.tone !== 'booked').map(slot => ({ from: slot.from, kind: 'gap', slot } as const))
 ].sort((a, b) => a.from - b.from);
 return <div className="booking-day">
  <div className="booking-day-summary"><span>{day.bookings.length} booking</span><b className={summaryClass(day)}>{availability(day)}</b></div>
  {rows.map(row => row.kind === 'booking'
   ? <BookingButton key={row.booking.id} booking={row.booking} onOpen={onOpen} />
   : <div key={'gap-' + row.from} className={'booking-interval booking-tone-' + row.slot.tone}>
    <span className="booking-time">{timeRange(row.slot.from, row.slot.to)}</span>
    <span className="booking-interval-name"><b>{row.slot.tone === 'free' ? 'Còn trống' : 'Chưa xác định giờ trống'}</b></span>
    <small>{bookingDuration(row.slot.to - row.slot.from)}</small>
   </div>)}
  {day.untimed.length > 0 && <UnscheduledProjects projects={day.untimed} heading={day.untimed.length + ' dự án chưa có đủ giờ booking'} onOpen={onOpen} />}
 </div>;
}

function WeekSchedule({ days, today, selected, onDay, onOpen }: {
 days: BookingDay[]; today: string; selected: string; onDay: (date: string) => void; onOpen: (id: string) => void;
}) {
 const window = bookingWindow(days), duration = window.to - window.from;
 const pct = (minute: number) => (minute - window.from) / duration * 100 + '%';
 const ticks = Array.from({ length: duration / 60 + 1 }, (_, i) => window.from + i * 60);
 const trackHeight = Math.min(720, Math.max(384, duration / 60 * 34));
 return <>
  <div className="booking-week-grid" style={{ '--booking-track-height': trackHeight + 'px' } as React.CSSProperties}>
   <div className="booking-axis"><div className="booking-week-heading">Giờ</div><div className="booking-track">
    {ticks.map(minute => <span key={minute} className="booking-tick" style={{ top: pct(minute) }}>{bookingClock(minute)}</span>)}
   </div></div>
   {days.map((day, i) => <div className="booking-week-column" key={day.date}>
    <button type="button" className={'booking-week-heading' + (day.date === selected ? ' booking-selected' : '')}
     onClick={() => onDay(day.date)} aria-current={day.date === today ? 'date' : undefined} aria-label={'Xem ngày ' + dateName(day.date) + ', ' + availability(day)}>
     <span>{WEEKDAYS[i]}</span><b>{shortDate(day.date)}</b><small className={summaryClass(day)}>{availability(day)}</small>
    </button>
    <div className="booking-track booking-column-track">
     {ticks.slice(1, -1).map(minute => <span className="booking-hour-line" key={minute} style={{ top: pct(minute) }} aria-hidden="true" />)}
     {day.segments.filter(s => s.tone !== 'booked').map(slot => <div key={slot.from} className={'booking-block booking-gap booking-tone-' + slot.tone}
      style={{ top: pct(slot.from), height: (slot.to - slot.from) / duration * 100 + '%' }} aria-label={timeRange(slot.from, slot.to) + (slot.tone === 'free' ? ' còn trống' : ' chưa xác định')}>
      {slot.to - slot.from >= 75 && <small>{slot.tone === 'free' ? 'Trống' : 'Chưa rõ'}</small>}
     </div>)}
     {bookingLanes(day.bookings).map(({ booking, lane, lanes }) => <button key={booking.id} type="button"
      className="booking-block booking-event booking-tone-booked"
      style={{ top: pct(booking.from), height: (booking.to - booking.from) / duration * 100 + '%', left: 'calc(' + lane / lanes * 100 + '% + 2px)', width: 'calc(' + 100 / lanes + '% - 4px)' }}
      onClick={() => onOpen(booking.id)} aria-label={'Xem dự án ' + bookingLabel(booking)} title={bookingLabel(booking)}>
      <b>{booking.name}</b><small>{timeRange(booking.from, booking.to)}</small>
     </button>)}
    </div>
   </div>)}
  </div>
  <div className="booking-week-compact">
   {days.map((day, i) => <div className="booking-compact-day" key={day.date}>
    <button type="button" className="booking-compact-heading" onClick={() => onDay(day.date)} aria-current={day.date === today ? 'date' : undefined}>
     <b>{WEEKDAYS[i]} · {shortDate(day.date)}</b><small className={summaryClass(day)}>{availability(day)} <ChevronRight size={14} aria-hidden="true" /></small>
    </button>
    <AvailabilityBar day={day} />
    {day.bookings.map(booking => <BookingButton key={booking.id} booking={booking} onOpen={onOpen} />)}
   </div>)}
  </div>
 </>;
}

function MonthSchedule({ days, today, selected, onDay }: { days: BookingDay[]; today: string; selected: string; onDay: (date: string) => void }) {
 return <div className="booking-month-grid">
  {WEEKDAYS.map(label => <span key={label} className="booking-month-heading">{label}</span>)}
  {days.map(day => {
   const number = Number(day.date.slice(8));
   if (day.date.slice(0, 7) !== selected.slice(0, 7)) return <div className="booking-month-cell booking-month-outside" key={day.date} aria-hidden="true">{number}</div>;
   const tone = day.bookings.length ? 'booked' : day.availabilityKnown ? 'free' : 'unknown';
   return <button key={day.date} type="button" className={'booking-month-cell booking-tone-' + tone + (day.date === selected ? ' booking-selected' : '')}
    onClick={() => onDay(day.date)} aria-current={day.date === today ? 'date' : undefined}
    aria-label={'Xem ngày ' + dateName(day.date) + ', ' + day.bookings.length + ' booking, ' + availability(day)}>
    <span className="booking-month-top"><b>{number}</b>{day.bookings.length > 0 && <small>{day.bookings.length} lịch</small>}</span>
    <small>{availability(day)}</small><AvailabilityBar day={day} />
   </button>;
  })}
 </div>;
}

export default function BookingCalendar({ projects, today, onOpen }: { projects: readonly Row[]; today: string; onOpen: (id: string) => void }) {
 const [view, setView] = useState<CalendarView>('week');
 const [selected, setSelected] = useState(today);
 const dayButton = useRef<HTMLButtonElement>(null);
 const index = useMemo(() => indexBookings(projects), [projects]);
 const dates = view === 'month' ? calendarMonth(selected) : view === 'week' ? calendarWeek(selected) : [selected];
 const days = dates.map(date => bookingDay(index, date));
 const label = view === 'day' ? dateName(selected) : view === 'week'
  ? shortDate(dates[0]) + ' – ' + displayDay(dates[6])
  : 'Tháng ' + Number(selected.slice(5, 7)) + '/' + selected.slice(0, 4);
 function openDay(date: string) {
  setSelected(date);
  setView('day');
  dayButton.current?.focus();
 }
 return <section className="card booking-calendar" aria-labelledby="booking-calendar-title">
  <div className="booking-title">
   <div className="booking-title-icon"><CalendarDays size={21} aria-hidden="true" /></div>
   <div><h2 id="booking-calendar-title">Lịch booking</h2><p>Lịch tổng hợp · Khung tính giờ trống {timeRange(BOOKING_HOURS.from, BOOKING_HOURS.to)} (GMT+7)</p></div>
  </div>
  <div className="booking-toolbar">
   <div className="booking-nav" role="group" aria-label="Điều hướng lịch">
    <button type="button" className="booking-control" aria-label="Kỳ trước" onClick={() => setSelected(day => shiftCalendar(day, view, -1))}><ChevronLeft size={17} aria-hidden="true" /></button>
    <button type="button" className="booking-control" aria-label="Kỳ sau" onClick={() => setSelected(day => shiftCalendar(day, view, 1))}><ChevronRight size={17} aria-hidden="true" /></button>
    <button type="button" className="booking-control" onClick={() => setSelected(today)}>Hôm nay</button>
   </div>
   <h3 aria-live="polite">{label}</h3>
   <div className="booking-view-switch" role="group" aria-label="Chế độ xem lịch">
    {VIEWS.map(item => <button key={item.id} ref={item.id === 'day' ? dayButton : undefined} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
   </div>
  </div>
  <div className="booking-legend">
   <span><i className="booking-dot booking-tone-free" />Còn trống</span>
   <span><i className="booking-dot booking-tone-booked" />Có booking</span>
   {days.some(day => day.untimed.length > 0) && <span><i className="booking-dot booking-tone-unknown" />Chưa rõ giờ</span>}
   <span className="booking-legend-hint">{view === 'month' ? 'Bấm ngày để xem từng khung giờ' : 'Bấm lịch xanh để mở dự án'}</span>
  </div>
  {view === 'day' ? <DaySchedule day={days[0]} onOpen={onOpen} />
   : view === 'week' ? <WeekSchedule days={days} today={today} selected={selected} onDay={openDay} onOpen={onOpen} />
   : <MonthSchedule days={days} today={today} selected={selected} onDay={openDay} />}
  <p className="booking-footnote"><Info size={15} aria-hidden="true" /><span>Giờ trống dựa trên toàn bộ booking trong StudioHub, không phụ thuộc bộ lọc danh sách dự án. Lịch ngoài khung giờ vẫn hiện theo giờ đã đặt.</span></p>
  {index.undated.length > 0 && <UnscheduledProjects projects={index.undated} heading={index.undated.length + ' dự án chưa có ngày booking'} onOpen={onOpen} />}
 </section>;
}
