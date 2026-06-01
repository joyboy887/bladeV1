import "server-only";

// Sends an email via Resend. No-ops if not configured.
export async function sendEmail(to, subject, html) {
  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM || !to) {
    console.log("[email] skipped (missing config or recipient):", to);
    return { skipped: true };
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);
    const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
    if (error) throw new Error(error.message);
    return { id: data?.id };
  } catch (err) {
    console.error("[email] send failed:", err?.message);
    return { error: err?.message ?? "email failed" };
  }
}
