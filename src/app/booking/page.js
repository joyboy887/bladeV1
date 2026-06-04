import { Nav } from "@/components/nav.js";
import { Container } from "@/components/ui/container.js";
import { BookingWizard } from "@/app/booking/booking-wizard.js";
import {
  getShopSettings,
  getActiveBarbers,
  getActiveServices,
  getBarberServiceLinks,
} from "@/lib/data.js";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const [shop, barbers, services, links] = await Promise.all([
    getShopSettings(),
    getActiveBarbers(),
    getActiveServices(),
    getBarberServiceLinks(),
  ]);

  // Attach currency display data the steps need.
  const servicesWithCurrency = services.map((s) => ({ ...s, currency: shop.currency }));

  return (
    <>
      <Nav shopName={shop.name} />
      <main className="py-10">
        <Container>
          <h1 className="text-4xl">Book an appointment</h1>
          <p className="mt-2 text-muted">{shop.tagline}</p>
          <div className="mt-8">
            <BookingWizard barbers={barbers} services={servicesWithCurrency} links={links} />
          </div>
        </Container>
      </main>
    </>
  );
}
