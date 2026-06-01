export function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-blade-red">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/12 bg-ink-soft px-4 py-3 text-fog " +
  "outline-none focus:border-blade-green min-h-12";
