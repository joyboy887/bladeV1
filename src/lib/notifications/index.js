import "server-only";
import { sendWhatsAppTemplate } from "./whatsapp.js";
import { sendEmail } from "./email.js";
import { formatTime12h } from "@/lib/format.js";

// WhatsApp template names. These MUST match templates approved in Meta Business
// Manager (see README → Notifications). Names are env-overridable so you can run
// different template names without code changes.
export const WA_TEMPLATES = {
  bookingConfirmation: process.env.WA_TEMPLATE_CONFIRMATION || "booking_confirmation",
  ownerNewBooking: process.env.WA_TEMPLATE_OWNER || "owner_new_booking",
  bookingCancelled: process.env.WA_TEMPLATE_CANCELLED || "booking_cancelled",
  bookingRescheduled: process.env.WA_TEMPLATE_RESCHEDULED || "booking_rescheduled",
};

// Fires customer + owner notifications for a new booking. Always fail-soft:
// returns a result object and never throws. Channels: WhatsApp (Cloud API) +
// email (Resend). Each no-ops cleanly if its provider isn't configured.
export async function sendBookingNotifications({ booking, barber, service, shop }) {
  const when = `${booking.booking_date} at ${formatTime12h(booking.booking_time)}`;
  const shopName = shop?.name ?? "The Blade";

  const customerHtml = `
    <h2>${shopName}</h2>
    <p>Hi ${booking.customer_name}, your booking is confirmed.</p>
    <p><strong>${service.name}</strong> with <strong>${barber.name}</strong><br/>${when}</p>
    <p>${shop?.tagline ?? ""}</p>`;
  const ownerHtml = `
    <h2>New booking</h2>
    <p>${booking.customer_name} booked <strong>${service.name}</strong> with
       <strong>${barber.name}</strong> on ${when}.</p>
    <p>Phone: ${booking.customer_phone}<br/>Email: ${booking.customer_email}</p>`;

  const ownerPhone = shop?.notify_phone || barber.phone || null;
  const ownerEmail = shop?.notify_email || barber.email || null;

  const results = await Promise.allSettled([
    // Customer: WhatsApp confirmation — {{1}} name {{2}} shop {{3}} service {{4}} barber {{5}} when
    sendWhatsAppTemplate(booking.customer_phone, WA_TEMPLATES.bookingConfirmation, [
      booking.customer_name,
      shopName,
      service.name,
      barber.name,
      when,
    ]),
    sendEmail(booking.customer_email, `Booking confirmed — ${shopName}`, customerHtml),
    // Owner: WhatsApp alert — {{1}} customer {{2}} service {{3}} barber {{4}} when {{5}} phone
    sendWhatsAppTemplate(ownerPhone, WA_TEMPLATES.ownerNewBooking, [
      booking.customer_name,
      service.name,
      barber.name,
      when,
      booking.customer_phone || "—",
    ]),
    sendEmail(ownerEmail, `New booking — ${booking.customer_name}`, ownerHtml),
  ]);
  return { results };
}

export async function sendCancellation({ booking, barber, service, shop }) {
  const when = `${booking.booking_date} at ${formatTime12h(booking.booking_time)}`;
  const shopName = shop?.name ?? "The Blade";
  const html = `<h2>${shopName}</h2><p>Hi ${booking.customer_name}, your booking on ${when} has been cancelled.</p><p>Call us to rebook.</p>`;
  const results = await Promise.allSettled([
    // {{1}} name {{2}} service {{3}} barber {{4}} when
    sendWhatsAppTemplate(booking.customer_phone || null, WA_TEMPLATES.bookingCancelled, [
      booking.customer_name,
      service?.name ?? "appointment",
      barber?.name ?? "us",
      when,
    ]),
    sendEmail(booking.customer_email || null, `Booking cancelled — ${shopName}`, html),
  ]);
  return { results };
}

export async function sendReschedule({ booking, barber, service, shop }) {
  const when = `${booking.booking_date} at ${formatTime12h(booking.booking_time)}`;
  const shopName = shop?.name ?? "The Blade";
  const html = `<h2>${shopName}</h2><p>Hi ${booking.customer_name}, your booking has been moved to <strong>${when}</strong> with ${barber?.name ?? "us"}.</p>`;
  const results = await Promise.allSettled([
    // {{1}} name {{2}} service {{3}} barber {{4}} when
    sendWhatsAppTemplate(booking.customer_phone || null, WA_TEMPLATES.bookingRescheduled, [
      booking.customer_name,
      service?.name ?? "appointment",
      barber?.name ?? "us",
      when,
    ]),
    sendEmail(booking.customer_email || null, `Booking updated — ${shopName}`, html),
  ]);
  return { results };
}
