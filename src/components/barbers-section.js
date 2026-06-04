import Image from "next/image";
import { Container } from "@/components/ui/container.js";
import { BarberMonogram } from "@/components/barber-monogram.js";

export function BarbersSection({ barbers }) {
  return (
    <section className="py-16">
      <Container>
        <h2 className="text-4xl">The Barbers</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((b) => (
            <div
              key={b.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-ink-soft"
            >
              <div className="relative aspect-[4/5]">
                {b.photo_url ? (
                  <Image
                    src={b.photo_url}
                    alt={b.name}
                    fill
                    sizes="(max-width:640px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <BarberMonogram name={b.name} className="h-full w-full" />
                )}
              </div>
              <div className="p-5">
                <h3 className="text-2xl">{b.name}</h3>
                {b.bio ? <p className="mt-1 text-sm text-muted">{b.bio}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
