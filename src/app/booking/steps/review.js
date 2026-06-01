"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button.js";
import { formatTime12h, formatPrice } from "@/lib/format.js";

export function StepReview({ data, onBack }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          barberId: data.barber.id,
          serviceId: data.service.id,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          date: data.date,
          time: data.time,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not create booking");
      router.push(`/confirmation?id=${body.id}&token=${body.token}`);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const row = (label, val) => (
    <div className="flex justify-between border-b border-white/10 py-3">
      <span className="text-muted">{label}</span>
      <span>{val}</span>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Review &amp; confirm</h2>
        <Button
          variant="ghost"
          className="h-10 min-h-0 px-5 text-sm"
          onClick={onBack}
          disabled={submitting}
        >
          Back
        </Button>
      </div>
      <div className="mt-6 max-w-md rounded-2xl border border-white/10 bg-ink-soft p-5">
        {row("Barber", data.barber.name)}
        {row("Service", data.service.name)}
        {row("Price", formatPrice(data.service.price, data.service.currency))}
        {row("Date", data.date)}
        {row("Time", formatTime12h(data.time))}
        {row("Name", data.customerName)}
        {row("Phone", data.customerPhone)}
        {row("Email", data.customerEmail)}
      </div>
      {error ? <p className="mt-4 max-w-md text-blade-red">{error}</p> : null}
      <Button
        className="mt-6 w-full max-w-md"
        variant="green"
        onClick={submit}
        disabled={submitting}
      >
        {submitting ? "Booking…" : "Confirm booking"}
      </Button>
    </div>
  );
}
