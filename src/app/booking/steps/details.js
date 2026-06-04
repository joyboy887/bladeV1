"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button.js";
import { Field, inputClass } from "@/components/ui/field.js";
import { bookingInputSchema } from "@/lib/validation.js";

export function StepDetails({ data, onChange, onBack, onNext }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const candidate = {
      barberId: data.barber.id,
      serviceId: data.service.id,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      date: data.date,
      time: data.time,
    };
    const result = bookingInputSchema.safeParse(candidate);
    if (result.success) {
      setErrors({});
      onNext();
      return;
    }
    setErrors(result.error.flatten().fieldErrors);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Your details</h2>
        <Button variant="ghost" className="h-10 min-h-0 px-5 text-sm" onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="mt-6 max-w-md space-y-4">
        <Field label="Full name" error={errors.customerName?.[0]}>
          <input
            className={inputClass}
            value={data.customerName}
            onChange={(e) => onChange({ customerName: e.target.value })}
          />
        </Field>
        <Field label="Phone number" error={errors.customerPhone?.[0]}>
          <input
            className={inputClass}
            inputMode="tel"
            value={data.customerPhone}
            onChange={(e) => onChange({ customerPhone: e.target.value })}
          />
        </Field>
        <Field label="Email" error={errors.customerEmail?.[0]}>
          <input
            className={inputClass}
            inputMode="email"
            value={data.customerEmail}
            onChange={(e) => onChange({ customerEmail: e.target.value })}
          />
        </Field>
        <Button className="w-full" onClick={validate}>
          Review booking
        </Button>
      </div>
    </div>
  );
}
