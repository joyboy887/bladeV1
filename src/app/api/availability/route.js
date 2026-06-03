import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server.js";
import { getAvailableSlots } from "@/lib/availability.js";
import { availabilityQuerySchema } from "@/lib/validation.js";
import { otherBookings } from "@/lib/reschedule.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    barberId: searchParams.get("barberId"),
    serviceId: searchParams.get("serviceId"),
    date: searchParams.get("date"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const { barberId, serviceId, date } = parsed.data;
  const excludeId = searchParams.get("excludeId");
  const db = createServiceClient();

  const [{ data: barber }, { data: service }, { data: shop }] = await Promise.all([
    db.from("barbers").select("id,availability").eq("id", barberId).single(),
    db.from("services").select("id,duration_minutes").eq("id", serviceId).single(),
    db.from("shop_settings").select("timezone").eq("id", 1).single(),
  ]);
  if (!barber || !service) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Existing non-cancelled bookings for this barber/date, joined to durations.
  const { data: bookings } = await db
    .from("bookings")
    .select("id, booking_time, services(duration_minutes)")
    .eq("barber_id", barberId)
    .eq("booking_date", date)
    .neq("status", "cancelled");

  const mapped = (bookings ?? []).map((b) => ({
    id: b.id,
    booking_time: b.booking_time.slice(0, 5),
    duration_minutes: b.services?.duration_minutes ?? 0,
  }));
  const existingBookings = otherBookings(mapped, excludeId);

  const { data: closures } = await db
    .from("closures")
    .select("barber_id,start_date,end_date")
    .lte("start_date", date)
    .gte("end_date", date);

  const slots = getAvailableSlots({
    barber,
    service,
    date,
    existingBookings,
    closures: closures ?? [],
    now: new Date(),
    timezone: shop?.timezone ?? "Europe/London",
  });

  return NextResponse.json({ slots });
}
