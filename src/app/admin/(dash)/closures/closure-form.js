"use client";
import { useActionState } from "react";
import { createClosure } from "./actions";

export default function ClosureForm({ barbers }) {
  const [state, formAction, pending] = useActionState(createClosure, {});
  const err = state?.fieldErrors || {};
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 420 }}>
      <label className="admin-label">Scope</label>
      <select className="admin-select" name="barber_id" defaultValue="">
        <option value="">Whole shop</option>
        {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <label className="admin-label">Start date</label>
      <input className="admin-input" type="date" name="start_date" />
      {err.start_date?.[0] && <p className="field-error">{err.start_date[0]}</p>}

      <label className="admin-label">End date</label>
      <input className="admin-input" type="date" name="end_date" />
      {err.end_date?.[0] && <p className="field-error">{err.end_date[0]}</p>}

      <label className="admin-label">Reason</label>
      <input className="admin-input" name="reason" />

      {state?.error && <p className="form-error">{state.error}</p>}
      {state?.ok && <p className="form-ok">Closure added.</p>}
      <button className="admin-btn" type="submit" disabled={pending} style={{ marginTop: "0.75rem" }}>
        {pending ? "Adding…" : "Add closure"}
      </button>
    </form>
  );
}
