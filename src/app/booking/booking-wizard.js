"use client";

import { useState } from "react";
import { StepIndicator } from "@/components/booking/step-indicator.js";
import { StepBarber } from "@/app/booking/steps/barber.js";
import { StepService } from "@/app/booking/steps/service.js";
import { StepDate } from "@/app/booking/steps/date.js";
import { StepTime } from "@/app/booking/steps/time.js";
import { StepDetails } from "@/app/booking/steps/details.js";
import { StepReview } from "@/app/booking/steps/review.js";

const EMPTY = {
  barber: null,
  service: null,
  date: null,
  time: null,
  customerName: "",
  customerPhone: "",
  customerEmail: "",
};

export function BookingWizard({ barbers, services, links }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(EMPTY);

  const set = (patch) => setData((d) => ({ ...d, ...patch }));
  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // Services offered by the chosen barber.
  const serviceIdsForBarber = new Set(
    links.filter((l) => l.barber_id === data.barber?.id).map((l) => l.service_id)
  );
  const barberServices = services.filter((s) => serviceIdsForBarber.has(s.id));

  return (
    <div className="space-y-8">
      <StepIndicator current={step} />
      {step === 0 && (
        <StepBarber
          barbers={barbers}
          value={data.barber}
          onSelect={(barber) => {
            set({ barber, service: null, date: null, time: null });
            next();
          }}
        />
      )}
      {step === 1 && (
        <StepService
          services={barberServices}
          value={data.service}
          onBack={back}
          onSelect={(service) => {
            set({ service, date: null, time: null });
            next();
          }}
        />
      )}
      {step === 2 && (
        <StepDate
          value={data.date}
          onBack={back}
          onSelect={(date) => {
            set({ date, time: null });
            next();
          }}
        />
      )}
      {step === 3 && (
        <StepTime
          barber={data.barber}
          service={data.service}
          date={data.date}
          value={data.time}
          onBack={back}
          onSelect={(time) => {
            set({ time });
            next();
          }}
        />
      )}
      {step === 4 && <StepDetails data={data} onChange={set} onBack={back} onNext={next} />}
      {step === 5 && <StepReview data={data} onBack={back} />}
    </div>
  );
}
