const STEPS = ["Barber", "Service", "Date", "Time", "Details", "Review"];

export function StepIndicator({ current }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {STEPS.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li
            key={label}
            className={
              "rounded-full border px-3 py-1 " +
              (active
                ? "border-blade-green text-blade-green"
                : done
                ? "border-white/20 text-fog"
                : "border-white/10 text-muted")
            }
          >
            {i + 1}. {label}
          </li>
        );
      })}
    </ol>
  );
}
