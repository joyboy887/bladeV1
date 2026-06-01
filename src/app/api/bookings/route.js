import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server.js";
import { getAvailableSlots } from "@/lib/availability.js";
import { bookingInputSchema } from "@/lib/validation.js";
import { sendBookingNotifications } from "@/lib/notifications/index.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const db = createServiceClient();

  const [{ data: barber }, { data: service }, { data: shop }] = await Promise.all([
    db.from("barbers").select("*").eq("id", input.barberId).single(),
    db.from("services").select("*").eq("id", input.serviceId).single(),
    db.from("shop_settings").select("*").eq("id", 1).single(),
  ]);
  if (!barber || !service) {
    return NextResponse.json({ error: "Barber or service not found" }, { status: 404 });
  }

  // Re-check availability server-side (defends against stale clients).
  const { data: dayBookings } = await db
    .from("bookings")
    .select("booking_time, services(duration_minutes)")
    .eq("barber_id", input.barberId)
    .eq("booking_date", input.date)
    .neq("status", "cancelled");
  const { data: closures } = await db
    .from("closures")
    .select("barber_id,start_date,end_date")
    .lte("start_date", input.date)
    .gte("end_date", input.date);

  const slots = getAvailableSlots({
    barber,
    service,
    date: input.date,
    existingBookings: (dayBookings ?? []).map((b) => ({
      booking_time: b.booking_time.slice(0, 5),
      duration_minutes: b.services?.duration_minutes ?? 0,
    })),
    closures: closures ?? [],
    now: new Date(),
    timezone: shop?.timezone ?? "Europe/London",
  });
  if (!slots.includes(input.time)) {
    return NextResponse.json(
      { error: "That time was just taken. Please pick another." },
      { status: 409 }
    );
  }

  // Insert. The partial unique index is the hard race backstop.
  const { data: booking, error } = await db
    .from("bookings")
    .insert({
      barber_id: input.barberId,
      service_id: input.serviceId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail,
      booking_date: input.date,
      booking_time: input.time,
    })
    .select(
      "id, manage_token, booking_date, booking_time, customer_name, customer_phone, customer_email"
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That time was just taken. Please pick another." },
        { status: 409 }
      );
    }
    console.error("[bookings] insert failed:", error);
    return NextResponse.json({ error: "Could not create booking" }, { status: 500 });
  }

  // Fire notifications (fail-soft; never blocks the response on errors).
  await sendBookingNotifications({ booking, barber, service, shop });

  return NextResponse.json(
    {
      id: booking.id,
      token: booking.manage_token,
      summary: {
        barber: barber.name,
        service: service.name,
        date: booking.booking_date,
        time: booking.booking_time.slice(0, 5),
        customerName: booking.customer_name,
      },
    },
    { status: 201 }
  );
}
