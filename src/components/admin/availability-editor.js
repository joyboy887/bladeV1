"use client";
import { useState } from "react";

const DAYS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"],
  ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

// Serializes a weekly availability object into a hidden JSON input named "availability".
export default function AvailabilityEditor({ value }) {
  const init = {};
  for (const [key] of DAYS) {
    const ranges = value?.[key] ?? [];
    const first = ranges[0] || null;
    init[key] = { open: ranges.length > 0, start: first?.start ?? "09:00", end: first?.end ?? "17:00" };
  }
  const [days, setDays] = useState(init);

  const json = {};
  for (const [key] of DAYS) {
    json[key] = days[key].open ? [{ start: days[key].start, end: days[key].end }] : [];
  }

  function update(key, patch) {
    setDays((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  }

  return (
    <div>
      <label className="admin-label">Weekly availability</label>
      <input type="hidden" name="availability" value={JSON.stringify(json)} readOnly />
      <table className="admin-table">
        <tbody>
          {DAYS.map(([key, label]) => (
            <tr key={key}>
              <td style={{ width: 110 }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={days[key].open} onChange={(e) => update(key, { open: e.target.checked })} />
                  {label}
                </label>
              </td>
              <td>
                <input className="admin-input" type="time" value={days[key].start} disabled={!days[key].open} onChange={(e) => update(key, { start: e.target.value })} style={{ width: 130 }} />
              </td>
              <td>
                <input className="admin-input" type="time" value={days[key].end} disabled={!days[key].open} onChange={(e) => update(key, { end: e.target.value })} style={{ width: 130 }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
