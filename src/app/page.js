import { Nav } from "@/components/nav.js";
import { Hero } from "@/components/hero.js";
import { ServicesSection } from "@/components/services-section.js";
import { BarbersSection } from "@/components/barbers-section.js";
import { Gallery } from "@/components/gallery.js";
import { Footer } from "@/components/footer.js";
import { getShopSettings, getActiveServices, getActiveBarbers } from "@/lib/data.js";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [shop, services, barbers] = await Promise.all([
    getShopSettings(),
    getActiveServices(),
    getActiveBarbers(),
  ]);
  return (
    <>
      <Nav shopName={shop.name} />
      <main>
        <Hero shop={shop} />
        <ServicesSection services={services} currency={shop.currency} />
        <BarbersSection barbers={barbers} />
        <Gallery />
      </main>
      <Footer shop={shop} />
    </>
  );
}
