"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button.js";
import { SlotGrid } from "@/components/booking/slot-grid.js";
import { formatTime12h } from "@/lib/format.js";

export function StepTime({ barber, service, date, value, onSelect, onBack }) {
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setSlots(null);
    setError(null);
    const url = `/api/availability?barberId=${barber.id}&serviceId=${service.id}&date=${date}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load times"))))
      .then((d) => {
        if (alive) setSlots(d.slots);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [barber.id, service.id, date]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Pick a time</h2>
        <Button variant="ghost" className="h-10 min-h-0 px-5 text-sm" onClick={onBack}>
          Back
        </Button>
      </div>
      <p className="mt-2 text-muted">
        {date} · {service.name} with {barber.name}
      </p>
      <div className="mt-6">
        {error ? <p className="text-blade-red">{error}</p> : null}
        {!error && slots === null ? <p className="text-muted">Loading times…</p> : null}
        {!error && slots !== null ? (
          <SlotGrid slots={slots} value={value} onPick={onSelect} />
        ) : null}
      </div>
      {value ? <p className="mt-4 text-blade-green">Selected: {formatTime12h(value)}</p> : null}
    </div>
  );
}
