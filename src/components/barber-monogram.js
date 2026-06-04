// Styled placeholder for barbers without a photo. PLACEHOLDER — swap for real
// photos via admin (Spec 2). Documented in README.
export function BarberMonogram({ name, className = "" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={`flex items-center justify-center bg-ink-soft text-fog ${className}`}
      aria-label={`${name} (photo coming soon)`}
    >
      <span className="font-display text-4xl text-glow-green">{initials}</span>
    </div>
  );
}
