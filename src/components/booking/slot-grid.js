import { formatTime12h } from "@/lib/format.js";

export function SlotGrid({ slots, value, onPick }) {
  if (slots.length === 0) {
    return <p className="text-muted">No times available for this day. Try another date.</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((t) => (
        <button
          key={t}
          onClick={() => onPick(t)}
          className={
            "rounded-xl border py-3 text-sm transition min-h-12 " +
            (value === t
              ? "border-blade-green text-blade-green glow-green"
              : "border-white/12 hover:border-white/35")
          }
        >
          {formatTime12h(t)}
        </button>
      ))}
    </div>
  );
}
