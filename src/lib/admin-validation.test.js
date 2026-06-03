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
