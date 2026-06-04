import { Button } from "@/components/ui/button.js";
import { formatPrice, formatDuration } from "@/lib/format.js";

export function StepService({ services, value, onSelect, onBack }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Choose a service</h2>
        <Button variant="ghost" className="h-10 min-h-0 px-5 text-sm" onClick={onBack}>
          Back
        </Button>
      </div>
      {services.length === 0 ? (
        <p className="mt-6 text-muted">This barber has no services configured.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className={
                "rounded-2xl border bg-ink-soft p-5 text-left transition " +
                (value?.id === s.id
                  ? "border-blade-green glow-green"
                  : "border-white/10 hover:border-white/30")
              }
            >
              <h3 className="text-2xl">{s.name}</h3>
              {s.description ? <p className="mt-1 text-sm text-muted">{s.description}</p> : null}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-blade-green">{formatPrice(s.price, s.currency)}</span>
                <span className="text-sm text-muted">{formatDuration(s.duration_minutes)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
