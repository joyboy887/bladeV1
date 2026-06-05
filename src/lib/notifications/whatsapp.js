import "server-only";

// Sends a WhatsApp message via Meta's WhatsApp Cloud API.
//
// Booking confirmations are *business-initiated* messages, which WhatsApp only
// permits as pre-approved TEMPLATES (free-form text is allowed only inside the
// 24h customer-service window). So every send here goes through a template name
// + positional body parameters that must match a template approved in Meta
// Business Manager. See README for the templates to create.
//
// Fail-soft: no-ops (returns {skipped:true}) when unconfigured or no recipient,
// and never throws — notifications must never break a booking.

const DEFAULT_API_VERSION = "v23.0";
const DEFAULT_LANG = "en";
const DEFAULT_COUNTRY_CODE = "44"; // United Kingdom

// Normalize a user-entered phone number to the bare international digits Cloud
// API expects (country code + number, no "+", no spaces). UK-friendly: a leading
// national "0" is swapped for the default country code.
export function normalizeWhatsAppNumber(raw) {
  if (!raw) return null;
  const countryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || DEFAULT_COUNTRY_CODE;

  let s = String(raw).trim();
  const hadPlus = s.startsWith("+");
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;

  if (hadPlus) return digits; // already international (e.g. +44 7911…)
  if (digits.startsWith("00")) return digits.slice(2); // 00 = intl. prefix
  if (digits.startsWith("0")) return countryCode + digits.slice(1); // national
  return digits; // assume already includes a country code
}

// Send a template message. `bodyParams` are the ordered {{1}}, {{2}}… values
// for the template's body component; pass [] for a template with no variables.
export async function sendWhatsAppTemplate(to, templateName, bodyParams = [], opts = {}) {
  const { WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN } = process.env;
  const recipient = normalizeWhatsAppNumber(to);
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN || !recipient || !templateName) {
    console.log("[whatsapp] skipped (missing config or recipient):", to);
    return { skipped: true };
  }

  const apiVersion = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const languageCode = opts.languageCode || process.env.WHATSAPP_TEMPLATE_LANG || DEFAULT_LANG;

  const template = {
    name: templateName,
    language: { code: languageCode },
  };
  if (bodyParams.length > 0) {
    template.components = [
      {
        type: "body",
        parameters: bodyParams.map((text) => ({ type: "text", text: String(text) })),
      },
    ];
  }

  const payload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template,
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error?.message || `HTTP ${res.status}`;
      console.error("[whatsapp] send failed:", message);
      return { error: message };
    }
    return { id: data?.messages?.[0]?.id };
  } catch (err) {
    console.error("[whatsapp] send failed:", err?.message);
    return { error: err?.message ?? "whatsapp failed" };
  }
}
