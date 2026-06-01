import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPrice, formatDuration, formatTime12h, addMinutesToHHMM } from "./format.js";

test("formatPrice renders GBP", () => {
  assert.equal(formatPrice(18, "GBP"), "£18.00");
  assert.equal(formatPrice(25.5, "GBP"), "£25.50");
});

test("formatDuration renders minutes and hours", () => {
  assert.equal(formatDuration(30), "30 min");
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(60), "1 hr");
  assert.equal(formatDuration(90), "1 hr 30 min");
});

test("formatTime12h converts 24h to 12h", () => {
  assert.equal(formatTime12h("09:00"), "9:00 AM");
  assert.equal(formatTime12h("13:30"), "1:30 PM");
  assert.equal(formatTime12h("00:00"), "12:00 AM");
});

test("addMinutesToHHMM adds and wraps within a day", () => {
  assert.equal(addMinutesToHHMM("09:00", 30), "09:30");
  assert.equal(addMinutesToHHMM("09:45", 30), "10:15");
});
