"use client";
import { useRouter, useSearchParams } from "next/navigation";

export default function BookingFilters({ barbers }) {
  const router = useRouter();
  const params = useSearchParams();
  function set(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/bookings?${next.toString()}`);
  }
  return (
    <div className="admin-card" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
      <div>
        <label className="admin-label">From</label>
        <input className="admin-input" type="date" defaultValue={params.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} />
      </div>
      <div>
        <label className="admin-label">To</label>
        <input className="admin-input" type="date" defaultValue={params.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} />
      </div>
      <div>
        <label className="admin-label">Barber</label>
        <select className="admin-select" defaultValue={params.get("barberId") ?? ""} onChange={(e) => set("barberId", e.target.value)}>
          <option value="">All</option>
          {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="admin-label">Status</label>
        <select className="admin-select" defaultValue={params.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
          <option value="">All</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
      </div>
    </div>
  );
}
