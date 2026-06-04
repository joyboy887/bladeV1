import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueSlug } from "./slug.js";

test("slugify lowercases and hyphenates", () => {
  assert.equal(slugify("Andre The Barber!"), "andre-the-barber");
});

test("slugify trims leading/trailing separators", () => {
  assert.equal(slugify("  --Marcus--  "), "marcus");
});

test("uniqueSlug returns base when unused", () => {
  assert.equal(uniqueSlug("andre", ["marcus", "deon"]), "andre");
});

test("uniqueSlug appends a counter on collision", () => {
  assert.equal(uniqueSlug("andre", ["andre", "andre-2"]), "andre-3");
});

test("uniqueSlug falls back when base is empty", () => {
  assert.equal(uniqueSlug("", []), "barber");
});
