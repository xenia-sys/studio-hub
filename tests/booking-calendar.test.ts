import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingDay, bookingLanes, bookingWindow, calendarMonth, calendarWeek, indexBookings, shiftCalendar } from '../lib/booking-calendar.ts';
import { emptyWorkspace, normalize, type Row } from '../lib/domain.ts';
import { projectDateValue } from '../lib/period.ts';

const day = '2026-11-06';
const project = (id: string, startTime: string, endTime: string, other: Partial<Row> = {}): Row =>
 ({ id, name: id, status: 'confirmed', start: day, startTime, endTime, ...other });

test('overlapping and adjacent bookings reserve the union of hours, while every project keeps a clickable lane', () => {
 const plan = bookingDay(indexBookings([
  project('first', '09:00', '12:00'), project('overlap', '11:00', '14:00', { resource: 'Room B' }),
  project('adjacent', '14:00', '15:00'), project('evening', '17:00', '18:30')
 ]), day);
 assert.equal(plan.openMinutes, 270);
 assert.deepEqual(plan.segments.map(s => [s.from, s.to, s.tone]), [
  [480, 540, 'free'], [540, 900, 'booked'], [900, 1020, 'free'], [1020, 1110, 'booked'], [1110, 1200, 'free']
 ]);
 assert.deepEqual(bookingLanes(plan.bookings).map(x => [x.booking.id, x.lane, x.lanes]), [
  ['first', 0, 2], ['overlap', 1, 2], ['adjacent', 0, 1], ['evening', 0, 1]
 ]);
});

test('early and late real bookings remain visible without deducting time outside the reference hours', () => {
 const plan = bookingDay(indexBookings([
  project('early', '07:00', '09:00'), project('late', '20:30', '22:15')
 ]), day);
 assert.deepEqual(bookingWindow([plan]), { from: 420, to: 1380 });
 assert.equal(plan.openMinutes, 660);
 assert.equal(plan.bookings.length, 2);
 assert.deepEqual(plan.segments, [{ from: 480, to: 540, tone: 'booked' }, { from: 540, to: 1200, tone: 'free' }]);
});

test('cancelled bookings release their hours, and invalid or missing hours cannot be reported as free', () => {
 const index = indexBookings([
  project('cancelled', '08:00', '20:00', { status: 'cancelled' }),
  project('completed', '10:00', '12:00', { status: 'completed' }),
  project('no-end', '14:00', ''), project('invalid-hour', '29:00', '29:59'),
  project('missing-date', '09:00', '10:00', { start: '' }),
  project('invalid-date', '09:00', '10:00', { start: '2026-02-30' })
 ]);
 const plan = bookingDay(index, day);
 assert.deepEqual(index.undated.map(p => p.id), ['missing-date', 'invalid-date']);
 assert.deepEqual(plan.bookings.map(p => p.id), ['completed']);
 assert.deepEqual(plan.untimed.map(p => p.id), ['no-end', 'invalid-hour']);
 assert.equal(plan.availabilityKnown, false);
 assert.deepEqual(plan.segments.map(s => s.tone), ['unknown', 'booked', 'unknown']);
 const empty = bookingDay(index, '2026-11-07');
 assert.equal(empty.openMinutes, 720);
 assert.deepEqual(empty.segments, [{ from: 480, to: 1200, tone: 'free' }]);
});

test('a full day has no gaps, and calendar navigation respects Monday, month ends and leap days', () => {
 const plan = bookingDay(indexBookings([project('morning', '08:00', '13:00'), project('afternoon', '13:00', '20:00')]), day);
 assert.equal(plan.openMinutes, 0);
 assert.deepEqual(plan.segments, [{ from: 480, to: 1200, tone: 'booked' }]);
 assert.deepEqual(calendarWeek(day), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
 const month = calendarMonth(day);
 assert.equal(month[0], '2026-10-26');
 assert.equal(month.at(-1), '2026-12-06');
 assert.equal(shiftCalendar('2024-01-31', 'month', 1), '2024-02-29');
 assert.equal(shiftCalendar('2026-12-31', 'day', 1), '2027-01-01');
});

test('an explicit booking date drives the calendar and project date filter independently of start and deadline', () => {
 const moved = project('booking', '08:30', '12:30', { start: '2026-10-31', due: '2026-11-08', bookingDate: '2026-11-07' });
 const index = indexBookings([moved]);
 assert.equal(bookingDay(index, '2026-10-31').bookings.length, 0);
 assert.equal(bookingDay(index, '2026-11-08').bookings.length, 0);
 assert.equal(bookingDay(index, '2026-11-07').openMinutes, 480);
 assert.equal(projectDateValue(moved, 'bookingDate'), '2026-11-07');
 assert.equal(projectDateValue(moved, 'start'), '2026-10-31');
 assert.equal(projectDateValue(moved, 'due'), '2026-11-08');
});

test('project saves retain the appointment date and check same-room conflicts on that date', () => {
 const state = emptyWorkspace({ userId: 'owner', email: 'owner@studio.test', displayName: 'Owner' });
 state.customers.push({ id: 'customer', name: 'Customer' });
 const input = project('', '09:00', '11:00', { name: 'Reservation', clientId: 'customer', service: 'Cho thuê studio', value: 0, resource: 'Room A', start: '2026-10-31', due: '2026-11-12', bookingDate: '2026-11-07' });
 const first = normalize(state, 'projects', input);
 state.projects.push(first);
 assert.throws(() => normalize(state, 'projects', { ...input, start: '2026-11-06', startTime: '10:00', endTime: '12:00' }), /trùng giờ/);
 const second = normalize(state, 'projects', { ...input, bookingDate: '2026-11-09' });
 assert.equal(second.bookingDate, '2026-11-09');
 const { bookingDate: _omitted, ...olderClient } = first;
 assert.equal(normalize(state, 'projects', olderClient, first).bookingDate, '2026-11-07');
 assert.throws(() => normalize(state, 'projects', { ...input, bookingDate: '2026-11-31' }), /không hợp lệ/);
});
