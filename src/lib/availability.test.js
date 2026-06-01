import { test } from "node:test";
import assert from "node:assert/strict";
import { getAvailableSlots, minutesToHHMM, hhmmToMinutes } from "./availability.js";

const barber = {
  availability: {
    mon: [{ start: "09:00", end: "12:00" }],
    tue: [],
    sat: [{ start: "09:00", end: "10:30" }],
  },
};
const service = { duration_minutes: 30 };
// A far-future Monday so "now" filtering never interferes.
const farMonday = "2099-01-05"; // 2099-01-05 is a Monday

test("generates 30-min grid within working hours", () => {
  const slots = getAvailableSlots({
    barber, service, date: farMonday,
    existingBookings: [], closures: [],
    now: new Date("2099-01-01T00:00:00Z"), timezone: "Europe/London",
  });
  assert.deepEqual(slots, ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
});

test("last slot must fit the full duration", () => {
  const farSaturday = "2099-01-10"; // Saturday, hours 09:00-10:30
  const slots = getAvailableSlots({
    barber, service, date: farSaturday,
    existingBookings: [], closures: [],
    now: new Date("2099-01-01T00:00:00Z"), timezone: "Europe/London",
  });
  // 09:00, 09:30, 10:00 (10:00+30=10:30 fits); 10:30 would end 11:00 > 10:30
  assert.deepEqual(slots, ["09:00", "09:30", "10:00"]);
});

test("a day with no hours yields no slots", () => {
  const farTuesday = "2099-01-06";
  const slots = getAvailableSlots({
    barber, service, date: farTuesday,
    existingBookings: [], closures: [],
    now: new Date("2099-01-01T00:00:00Z"), timezone: "Europe/London",
  });
  assert.deepEqual(slots, []);
});

test("overlapping bookings are removed using their own durations", () => {
  const existingBookings = [
    { booking_time: "09:30", duration_minutes: 60 }, // blocks 09:30-10:30
  ];
  const slots = getAvailableSlots({
    barber, service, date: farMonday,
    existingBookings, closures: [],
    now: new Date("2099-01-01T00:00:00Z"), timezone: "Europe/London",
  });
  // 09:00 ok (ends 09:30). 09:30,10:00 blocked. 10:30,11:00,11:30 ok.
  assert.deepEqual(slots, ["09:00", "10:30", "11:00", "11:30"]);
});

test("a closure covering the date yields no slots", () => {
  const slots = getAvailableSlots({
    barber, service, date: farMonday,
    existingBookings: [],
    closures: [{ barber_id: null, start_date: "2099-01-01", end_date: "2099-12-31" }],
    now: new Date("2099-01-01T00:00:00Z"), timezone: "Europe/London",
  });
  assert.deepEqual(slots, []);
});

test("same-day past times are filtered with lead time", () => {
  // 'now' = farMonday 10:00 London; lead time 15 min -> first bookable >= 10:15 -> 10:30
  const slots = getAvailableSlots({
    barber, service, date: farMonday,
    existingBookings: [], closures: [],
    now: new Date("2099-01-05T10:00:00Z"), timezone: "Europe/London",
  });
  assert.deepEqual(slots, ["10:30", "11:00", "11:30"]);
});

test("hhmm/minutes round-trip", () => {
  assert.equal(hhmmToMinutes("09:30"), 570);
  assert.equal(minutesToHHMM(570), "09:30");
});
