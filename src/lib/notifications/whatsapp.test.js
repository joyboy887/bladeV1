import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { normalizeWhatsAppNumber, sendWhatsAppTemplate } from "./whatsapp.js";

// --- normalizeWhatsAppNumber -------------------------------------------------

test("normalizeWhatsAppNumber converts UK national (0...) to E.164 digits", () => {
  assert.equal(normalizeWhatsAppNumber("07911 123456"), "447911123456");
  assert.equal(normalizeWhatsAppNumber("07911-123456"), "447911123456");
  assert.equal(normalizeWhatsAppNumber("(07911) 123456"), "447911123456");
});

test("normalizeWhatsAppNumber strips + and 00 international prefixes", () => {
  assert.equal(normalizeWhatsAppNumber("+44 7911 123456"), "447911123456");
  assert.equal(normalizeWhatsAppNumber("0044 7911 123456"), "447911123456");
});

test("normalizeWhatsAppNumber leaves an already-international number intact", () => {
  assert.equal(normalizeWhatsAppNumber("447911123456"), "447911123456");
});

test("normalizeWhatsAppNumber returns null for empty/missing input", () => {
  assert.equal(normalizeWhatsAppNumber(""), null);
  assert.equal(normalizeWhatsAppNumber(null), null);
  assert.equal(normalizeWhatsAppNumber(undefined), null);
});

// --- sendWhatsAppTemplate ----------------------------------------------------

const ENV_KEYS = [
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_API_VERSION",
  "WHATSAPP_TEMPLATE_LANG",
  "WHATSAPP_DEFAULT_COUNTRY_CODE",
];
let savedEnv;
let savedFetch;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  savedFetch = global.fetch;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  global.fetch = savedFetch;
});

test("sendWhatsAppTemplate skips (no fetch) when not configured", async () => {
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  let called = false;
  global.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const res = await sendWhatsAppTemplate("07911123456", "booking_confirmation", ["x"]);
  assert.deepEqual(res, { skipped: true });
  assert.equal(called, false);
});

test("sendWhatsAppTemplate skips when recipient is missing", async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
  process.env.WHATSAPP_ACCESS_TOKEN = "tok";
  let called = false;
  global.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const res = await sendWhatsAppTemplate("", "booking_confirmation", ["x"]);
  assert.deepEqual(res, { skipped: true });
  assert.equal(called, false);
});

test("sendWhatsAppTemplate posts a correct Cloud API payload and returns the message id", async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "PNID";
  process.env.WHATSAPP_ACCESS_TOKEN = "TOKEN";
  process.env.WHATSAPP_API_VERSION = "v23.0";
  process.env.WHATSAPP_TEMPLATE_LANG = "en";

  let captured;
  global.fetch = async (url, opts) => {
    captured = { url, opts };
    return new Response(JSON.stringify({ messages: [{ id: "wamid.ABC" }] }), {
      status: 200,
    });
  };

  const res = await sendWhatsAppTemplate("07911 123456", "booking_confirmation", [
    "Sam",
    "The Blade",
  ]);

  assert.deepEqual(res, { id: "wamid.ABC" });
  assert.equal(captured.url, "https://graph.facebook.com/v23.0/PNID/messages");
  assert.equal(captured.opts.method, "POST");
  assert.equal(captured.opts.headers.Authorization, "Bearer TOKEN");
  assert.equal(captured.opts.headers["Content-Type"], "application/json");

  const body = JSON.parse(captured.opts.body);
  assert.equal(body.messaging_product, "whatsapp");
  assert.equal(body.to, "447911123456"); // normalized
  assert.equal(body.type, "template");
  assert.equal(body.template.name, "booking_confirmation");
  assert.equal(body.template.language.code, "en");
  const bodyComponent = body.template.components.find((c) => c.type === "body");
  assert.deepEqual(
    bodyComponent.parameters.map((p) => p.text),
    ["Sam", "The Blade"]
  );
  assert.equal(bodyComponent.parameters[0].type, "text");
});

test("sendWhatsAppTemplate returns an error object on a non-ok response (never throws)", async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "PNID";
  process.env.WHATSAPP_ACCESS_TOKEN = "TOKEN";
  global.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "Template not found" } }), {
      status: 400,
    });

  const res = await sendWhatsAppTemplate("447911123456", "missing_template", []);
  assert.ok(res.error);
  assert.match(res.error, /Template not found/);
});

test("sendWhatsAppTemplate omits the body component when there are no parameters", async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "PNID";
  process.env.WHATSAPP_ACCESS_TOKEN = "TOKEN";
  let captured;
  global.fetch = async (url, opts) => {
    captured = JSON.parse(opts.body);
    return new Response(JSON.stringify({ messages: [{ id: "wamid.X" }] }), { status: 200 });
  };
  await sendWhatsAppTemplate("447911123456", "owner_ping", []);
  assert.equal(captured.template.components, undefined);
});
