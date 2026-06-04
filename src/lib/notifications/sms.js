import "server-only";

// Sends an SMS via Twilio. No-ops (returns {skipped:true}) if not configured.
export async function sendSms(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !to) {
    console.log("[sms] skipped (missing config or recipient):", to);
    return { skipped: true };
  }
  try {
    const { default: twilio } = await import("twilio");
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({ to, from: TWILIO_FROM_NUMBER, body });
    return { sid: msg.sid };
  } catch (err) {
    console.error("[sms] send failed:", err?.message);
    return { error: err?.message ?? "sms failed" };
  }
}
