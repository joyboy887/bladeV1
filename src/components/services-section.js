import { Container } from "@/components/ui/container.js";
import { formatPrice, formatDuration } from "@/lib/format.js";

export function ServicesSection({ services, currency }) {
  return (
    <section className="py-16">
      <Container>
        <h2 className="text-4xl">Services</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <div key={s.id} className="rounded-2xl border border-white/10 bg-ink-soft p-5">
              <h3 className="text-2xl">{s.name}</h3>
              {s.description ? <p className="mt-1 text-sm text-muted">{s.description}</p> : null}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-blade-green">{formatPrice(s.price, currency)}</span>
                <span className="text-sm text-muted">{formatDuration(s.duration_minutes)}</span>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
