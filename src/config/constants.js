// Booking slot grid in minutes.
export const SLOT_STEP_MINUTES = 30;

// Minimum lead time before a same-day slot can be booked.
export const LEAD_TIME_MINUTES = 15;

// Weekday keys matching the barbers.availability JSON.
// Index aligns with JS Date.getDay() in the shop timezone (0 = Sunday).
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// How many days ahead customers may book.
export const BOOKING_HORIZON_DAYS = 60;
