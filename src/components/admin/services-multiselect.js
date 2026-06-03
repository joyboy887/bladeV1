"use client";

// Renders a checkbox per service; checked ones submit as repeated name="serviceIds".
export default function ServicesMultiselect({ services, selectedIds }) {
  const selected = new Set(selectedIds || []);
  return (
    <div>
      <label className="admin-label">Services offered</label>
      {services.map((s) => (
        <label key={s.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={selected.has(s.id)} />
          {s.name}
        </label>
      ))}
    </div>
  );
}
