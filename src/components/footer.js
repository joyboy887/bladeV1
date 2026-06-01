import { Container } from "@/components/ui/container.js";

export function Footer({ shop }) {
  return (
    <footer className="border-t border-white/10 py-12">
      <Container className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-2xl text-blade-red text-glow-red">{shop.name}</h3>
          <p className="mt-1 text-muted">{shop.tagline}</p>
        </div>
        <div className="text-sm text-muted sm:text-right">
          {shop.address ? <p>{shop.address}</p> : null}
          {shop.phone ? <p>{shop.phone}</p> : null}
          {shop.email ? <p>{shop.email}</p> : null}
          {shop.instagram ? <p>{shop.instagram}</p> : null}
        </div>
      </Container>
    </footer>
  );
}
