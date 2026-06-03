import { test } from "node:test";
import assert from "node:assert/strict";
import { shopSchema } from "./admin-validation.js";

test("shopSchema accepts a valid shop settings payload", () => {
  const parsed = shopSchema.parse({
    name: "The Blade",
    tagline: "Sharp cuts.",
    hero_text: "Precision cuts",
    hero_subtext: "Book now",
    phone: "",
    email: "",
    address: "",
    instagram: "",
    currency: "GBP",
    timezone: "Europe/London",
    notify_phone: "",
    notify_email: "",
  });
  assert.equal(parsed.name, "The Blade");
  assert.equal(parsed.currency, "GBP");
});

test("shopSchema rejects empty name", () => {
  assert.throws(() =>
    shopSchema.parse({ name: "", tagline: "x", currency: "GBP", timezone: "Europe/London" })
  );
});

test("shopSchema rejects bad email when provided", () => {
  assert.throws(() =>
    shopSchema.parse({ name: "x", tagline: "y", email: "not-an-email", currency: "GBP", timezone: "Europe/London" })
  );
});

import { serviceSchema } from "./admin-validation.js";

test("serviceSchema coerces numeric strings", () => {
  const parsed = serviceSchema.parse({
    name: "Haircut",
    description: "Cut",
    duration_minutes: "30",
    price: "18.00",
    sort_order: "1",
    active: "on",
  });
  assert.equal(parsed.duration_minutes, 30);
  assert.equal(parsed.price, 18);
  assert.equal(parsed.active, true);
});

test("serviceSchema rejects zero duration", () => {
  assert.throws(() =>
    serviceSchema.parse({ name: "x", duration_minutes: "0", price: "5" })
  );
});

test("serviceSchema treats missing checkbox as inactive", () => {
  const parsed = serviceSchema.parse({ name: "x", duration_minutes: "15", price: "5" });
  assert.equal(parsed.active, false);
});

import { barberSchema, availabilitySchema } from "./admin-validation.js";

test("availabilitySchema accepts a weekly object with one range per day", () => {
  const parsed = availabilitySchema.parse({
    mon: [{ start: "09:00", end: "17:00" }],
    tue: [],
    wed: [{ start: "10:00", end: "18:00" }],
    thu: [], fri: [], sat: [], sun: [],
  });
  assert.equal(parsed.mon[0].end, "17:00");
});

test("availabilitySchema rejects end before start", () => {
  assert.throws(() =>
    availabilitySchema.parse({
      mon: [{ start: "17:00", end: "09:00" }],
      tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    })
  );
});

test("barberSchema parses serviceIds and active checkbox", () => {
  const parsed = barberSchema.parse({
    name: "Andre",
    bio: "",
    phone: "",
    email: "",
    sort_order: "3",
    active: "on",
    serviceIds: ["11111111-1111-1111-1111-111111111111"],
  });
  assert.equal(parsed.name, "Andre");
  assert.equal(parsed.serviceIds.length, 1);
  assert.equal(parsed.active, true);
});
