import { TZDate } from "@date-fns/tz";
import {
  SLOT_STEP_MINUTES,
  LEAD_TIME_MINUTES,
  WEEKDAY_KEYS,
} from "../config/constants.js";

export function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHHMM(total) {
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Weekday key (sun..sat) for a YYYY-MM-DD date in the shop timezone.
function weekdayKey(dateStr, timezone) {
  const d = new TZDate(`${dateStr}T12:00:00`, timezone);
  return WEEKDAY_KEYS[d.getDay()];
}

function dateIsClosed(dateStr, barberId, closures) {
  return closures.some((c) => {
    const appliesToBarber = c.barber_id == null || c.barber_id === barberId;
    return appliesToBarber && dateStr >= c.start_date && dateStr <= c.end_date;
  });
}

// Minutes-since-midnight "now" in the shop timezone, or null if date != today.
function sameDayCutoffMinutes(dateStr, now, timezone) {
  const tzNow = new TZDate(now, timezone);
  const todayStr = [
    tzNow.getFullYear(),
    String(tzNow.getMonth() + 1).padStart(2, "0"),
    String(tzNow.getDate()).padStart(2, "0"),
  ].join("-");
  if (dateStr !== todayStr) return null;
  return tzNow.getHours() * 60 + tzNow.getMinutes() + LEAD_TIME_MINUTES;
}

/**
 * Compute bookable start times (HH:MM) for a barber/service/date.
 * @param {object} args
 * @param {{availability:object, id?:string}} args.barber
 * @param {{duration_minutes:number}} args.service
 * @param {string} args.date  YYYY-MM-DD
 * @param {Array<{booking_time:string, duration_minutes:number}>} args.existingBookings
 * @param {Array<{barber_id:?string, start_date:string, end_date:string}>} args.closures
 * @param {Date} args.now
 * @param {string} args.timezone
 * @returns {string[]}
 */
export function getAvailableSlots({
  barber,
  service,
  date,
  existingBookings = [],
  closures = [],
  now = new Date(),
  timezone = "Europe/London",
}) {
  if (dateIsClosed(date, barber.id ?? null, closures)) return [];

  const intervals = barber.availability?.[weekdayKey(date, timezone)] ?? [];
  if (intervals.length === 0) return [];

  const duration = service.duration_minutes;
  const cutoff = sameDayCutoffMinutes(date, now, timezone);

  // Busy ranges from existing (non-cancelled) bookings.
  const busy = existingBookings.map((b) => {
    const start = hhmmToMinutes(b.booking_time);
    return [start, start + (b.duration_minutes ?? 0)];
  });

  const slots = [];
  for (const { start, end } of intervals) {
    const open = hhmmToMinutes(start);
    const close = hhmmToMinutes(end);
    for (let t = open; t + duration <= close; t += SLOT_STEP_MINUTES) {
      if (cutoff != null && t < cutoff) continue;
      const slotEnd = t + duration;
      const overlaps = busy.some(([bs, be]) => t < be && slotEnd > bs);
      if (!overlaps) slots.push(minutesToHHMM(t));
    }
  }
  return slots;
}
