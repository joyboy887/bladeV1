import { Nav } from "@/components/nav.js";
import { Container } from "@/components/ui/container.js";
import { Button } from "@/components/ui/button.js";
import { formatTime12h } from "@/lib/format.js";
import { getShopSettings, getBookingById } from "@/lib/data.js";
import { createServiceClient } from "@/lib/supabase/server.js";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ searchParams }) {
  const params = await searchParams;
  const shop = await getShopSettings();
  const booking =
    params?.id && params?.token ? await getBookingById(params.id, params.token) : null;

  if (!booking) {
    return (
      <>
        <Nav shopName={shop.name} />
        <main className="py-20">
          <Container>
            <h1 className="text-4xl">Booking not found</h1>
            <p className="mt-2 text-muted">We couldn’t find that booking.</p>
            <Button as="link" href="/booking" className="mt-6">
              Make a booking
            </Button>
          </Container>
        </main>
      </>
    );
  }

  const db = createServiceClient();
  const [{ data: barber }, { data: service }] = await Promise.all([
    db.from("barbers").select("name").eq("id", booking.barber_id).single(),
    db.from("services").select("name").eq("id", booking.service_id).single(),
  ]);

  return (
    <>
      <Nav shopName={shop.name} />
      <main className="py-16">
        <Container>
          <div className="max-w-lg rounded-2xl border border-blade-green/40 bg-ink-soft p-8 glow-green">
            <p className="text-blade-green text-glow-green">You’re booked in ✂</p>
            <h1 className="mt-2 text-4xl">
              See you soon, {booking.customer_name.split(" ")[0]}!
            </h1>
            <div className="mt-6 space-y-2 text-fog">
              <p>
                <span className="text-muted">Barber:</span> {barber?.name}
              </p>
              <p>
                <span className="text-muted">Service:</span> {service?.name}
              </p>
              <p>
                <span className="text-muted">Date:</span> {booking.booking_date}
              </p>
              <p>
                <span className="text-muted">Time:</span>{" "}
                {formatTime12h(booking.booking_time.slice(0, 5))}
              </p>
            </div>
            <p className="mt-6 text-sm text-muted">
              A confirmation has been sent to your phone and email. {shop.tagline}
            </p>
            <Button as="link" href="/" variant="ghost" className="mt-6">
              Back to home
            </Button>
          </div>
        </Container>
      </main>
    </>
  );
}
