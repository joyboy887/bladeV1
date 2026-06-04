import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingInputSchema } from "./validation.js";

const valid = {
  barberId: "11111111-1111-1111-1111-111111111111",
  serviceId: "22222222-2222-2222-2222-222222222222",
  customerName: "Sam Jones",
  customerPhone: "+447700900123",
  customerEmail: "sam@example.com",
  date: "2099-01-05",
  time: "09:30",
};

test("accepts a valid booking input", () => {
  const parsed = bookingInputSchema.parse(valid);
  assert.equal(parsed.customerName, "Sam Jones");
});

test("rejects a bad email", () => {
  assert.throws(() => bookingInputSchema.parse({ ...valid, customerEmail: "nope" }));
});

test("rejects a bad date format", () => {
  assert.throws(() => bookingInputSchema.parse({ ...valid, date: "05/01/2099" }));
});

test("rejects a bad time format", () => {
  assert.throws(() => bookingInputSchema.parse({ ...valid, time: "9am" }));
});

test("rejects an empty name", () => {
  assert.throws(() => bookingInputSchema.parse({ ...valid, customerName: "" }));
});
