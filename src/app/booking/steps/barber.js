import Image from "next/image";
import { BarberMonogram } from "@/components/barber-monogram.js";

export function StepBarber({ barbers, value, onSelect }) {
  return (
    <div>
      <h2 className="text-3xl">Choose your barber</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {barbers.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b)}
            className={
              "overflow-hidden rounded-2xl border bg-ink-soft text-left transition " +
              (value?.id === b.id
                ? "border-blade-green glow-green"
                : "border-white/10 hover:border-white/30")
            }
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
            <div className="p-4">
              <h3 className="text-2xl">{b.name}</h3>
              {b.bio ? <p className="mt-1 text-sm text-muted">{b.bio}</p> : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
