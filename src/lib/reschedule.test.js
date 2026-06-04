import { test } from "node:test";
import assert from "node:assert/strict";
import { otherBookings } from "./reschedule.js";

test("otherBookings drops the booking being moved", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(otherBookings(list, "b"), [{ id: "a" }, { id: "c" }]);
});

test("otherBookings returns all when excludeId is null", () => {
  const list = [{ id: "a" }];
  assert.deepEqual(otherBookings(list, null), [{ id: "a" }]);
});
