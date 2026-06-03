"use client";
import { useState } from "react";
import { useActionState } from "react";
import { reschedule } from "./actions";
import SlotPicker from "@/components/admin/slot-picker";

export default function RescheduleForm({ booking, barbers }) {
  const [barberId, setBarberId] = useState(booking.barber_id);
  const [state, formAction, pending] = useActionState(reschedule, {});
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 460 }}>
      <input type="hidden" name="id" defaultValue={booking.id} />
      <input type="hidden" name="barberId" value={barberId} readOnly />

      <label className="admin-label">Barber</label>
      <select className="admin-select" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
        {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <SlotPicker barberId={barberId} serviceId={booking.service_id} excludeId={booking.id} />

      {state?.error && <p className="form-error">{state.error}</p>}
      <button className="admin-btn" type="submit" disabled={pending} style={{ marginTop: "0.75rem" }}>
        {pending ? "Saving…" : "Confirm new time"}
      </button>
    </form>
  );
}
