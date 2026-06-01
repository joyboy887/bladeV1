"use client";

import { useState } from "react";
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isBefore,
  startOfDay,
  addDays,
} from "date-fns";
import { BOOKING_HORIZON_DAYS } from "@/config/constants.js";

export function MonthCalendar({ value, onPick }) {
  const today = startOfDay(new Date());
  const horizon = addDays(today, BOOKING_HORIZON_DAYS);
  const [month, setMonth] = useState(startOfMonth(value ? new Date(value) : today));

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
      <div className="flex items-center justify-between">
        <button
          className="px-3 py-1 text-muted hover:text-fog disabled:opacity-30"
          onClick={() => setMonth(addMonths(month, -1))}
          disabled={isBefore(startOfMonth(month), startOfMonth(today))}
        >
          ‹
        </button>
        <span className="font-display text-xl">{format(month, "MMMM yyyy")}</span>
        <button
          className="px-3 py-1 text-muted hover:text-fog"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          ›
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const past = isBefore(day, today);
          const beyond = isBefore(horizon, day);
          const disabled = past || beyond;
          const iso = format(day, "yyyy-MM-dd");
          const selected = value === iso;
          return (
            <button
              key={iso}
              disabled={disabled}
              onClick={() => onPick(iso)}
              className={
                "aspect-square rounded-lg text-sm transition " +
                (selected ? "bg-blade-green text-ink " : "") +
                (!selected && !disabled ? "hover:bg-white/10 " : "") +
                (disabled ? "text-white/15 " : inMonth ? "text-fog " : "text-muted ")
              }
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
