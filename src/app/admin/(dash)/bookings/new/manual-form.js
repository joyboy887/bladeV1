"use client";
import { useState } from "react";
import { useActionState } from "react";
import { createBooking } from "./actions";
import SlotPicker from "@/components/admin/slot-picker";

export default function ManualForm({ barbers, services }) {
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(createBooking, {});
  const err = state?.fieldErrors || {};
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 460 }}>
      <input type="hidden" name="barberId" value={barberId} readOnly />
      <input type="hidden" name="serviceId" value={serviceId} readOnly />

      <label className="admin-label">Barber</label>
      <select className="admin-select" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
        {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <label className="admin-label">Service</label>
      <select className="admin-select" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</option>)}
      </select>

      <label className="admin-label">Customer name</label>
      <input className="admin-input" name="customerName" />
      {err.customerName?.[0] && <p className="field-error">{err.customerName[0]}</p>}

      <label className="admin-label">Phone (optional)</label>
      <input className="admin-input" name="customerPhone" />

      <label className="admin-label">Email (optional)</label>
      <input className="admin-input" name="customerEmail" />
      {err.customerEmail?.[0] && <p className="field-error">{err.customerEmail[0]}</p>}

      <SlotPicker barberId={barberId} serviceId={serviceId} />

      {state?.error && <p className="form-error">{state.error}</p>}
      <button className="admin-btn" type="submit" disabled={pending} style={{ marginTop: "0.75rem" }}>
        {pending ? "Creating…" : "Create booking"}
      </button>
    </form>
  );
}
