import "server-only";
import { sendSms } from "./sms.js";
import { sendEmail } from "./email.js";
import { formatTime12h } from "@/lib/format.js";

// Fires customer + owner notifications for a new booking. Always fail-soft:
// returns a result object and never throws.
export async function sendBookingNotifications({ booking, barber, service, shop }) {
  const when = `${booking.booking_date} at ${formatTime12h(booking.booking_time)}`;
  const customerMsg =
    `${shop.name}: booking confirmed with ${barber.name} for ${service.name} on ${when}. See you soon!`;
  const ownerMsg =
    `New booking: ${booking.customer_name} — ${service.name} with ${barber.name} on ${when}. Phone: ${booking.customer_phone}`;

  const customerHtml = `
    <h2>${shop.name}</h2>
    <p>Hi ${booking.customer_name}, your booking is confirmed.</p>
    <p><strong>${service.name}</strong> with <strong>${barber.name}</strong><br/>${when}</p>
    <p>${shop.tagline}</p>`;
  const ownerHtml = `
    <h2>New booking</h2>
    <p>${booking.customer_name} booked <strong>${service.name}</strong> with
       <strong>${barber.name}</strong> on ${when}.</p>
    <p>Phone: ${booking.customer_phone}<br/>Email: ${booking.customer_email}</p>`;

  const ownerPhone = shop.notify_phone || barber.phone || null;
  const ownerEmail = shop.notify_email || barber.email || null;

  const results = await Promise.allSettled([
    sendSms(booking.customer_phone, customerMsg),
    sendEmail(booking.customer_email, `Booking confirmed — ${shop.name}`, customerHtml),
    sendSms(ownerPhone, ownerMsg),
    sendEmail(ownerEmail, `New booking — ${booking.customer_name}`, ownerHtml),
  ]);
  return { results };
}
