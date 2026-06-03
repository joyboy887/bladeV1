"use client";
import { useEffect, useState } from "react";

// Fetches slots from the existing public availability API and renders radio options.
// excludeId is passed so the API can ignore the booking being moved.
export default function SlotPicker({ barberId, serviceId, excludeId = "" }) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    const url = `/api/availability?barberId=${barberId}&serviceId=${serviceId}&date=${date}${excludeId ? `&excludeId=${excludeId}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []))
      .finally(() => setLoading(false));
  }, [date, barberId, serviceId, excludeId]);

  return (
    <div>
      <input type="hidden" name="date" value={date} readOnly />
      <label className="admin-label">Date</label>
      <input className="admin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <label className="admin-label">Time</label>
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && date && slots.length === 0 ? <p className="muted">No slots available.</p> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {slots.map((s) => (
          <label key={s} className="badge badge-confirmed" style={{ cursor: "pointer" }}>
            <input type="radio" name="time" value={s} required /> {s}
          </label>
        ))}
      </div>
    </div>
  );
}
