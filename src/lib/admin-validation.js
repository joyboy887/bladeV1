import { z } from "zod";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

// Optional text: empty string allowed, trimmed.
const optText = z.string().trim().max(500).optional().default("");
// Optional email: empty string OR a valid email.

// Checkbox: HTML sends "on" when checked, nothing when not.
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const intFromString = z.coerce.number().int();
const numFromString = z.coerce.number();

const optEmail = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email")
  .optional()
  .default("");

export const shopSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  tagline: z.string().trim().min(1, "Tagline is required").max(200),
  hero_text: optText,
  hero_subtext: optText,
  phone: optText,
  email: optEmail,
  address: optText,
  instagram: optText,
  currency: z.string().trim().min(1).max(8),
  timezone: z.string().trim().min(1).max(64),
  notify_phone: optText,
  notify_email: optEmail,
});

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optText,
  duration_minutes: intFromString.refine((n) => n > 0, "Duration must be greater than 0"),
  price: numFromString.refine((n) => n >= 0, "Price cannot be negative"),
  sort_order: intFromString.refine((n) => n >= 0, "Sort order cannot be negative").default(0),
  active: checkbox.default(false),
});

const rangeSchema = z
  .object({ start: z.string().regex(timeRe, "Invalid time"), end: z.string().regex(timeRe, "Invalid time") })
  .refine((r) => r.start < r.end, "End must be after start");

const dayList = z.array(rangeSchema).default([]);

export const availabilitySchema = z.object({
  sun: dayList, mon: dayList, tue: dayList, wed: dayList, thu: dayList, fri: dayList, sat: dayList,
});

export const barberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  bio: optText,
  phone: optText,
  email: optEmail,
  sort_order: intFromString.refine((n) => n >= 0, "Sort order cannot be negative").default(0),
  active: checkbox.default(false),
  serviceIds: z.array(z.string().uuid()).default([]),
});

export const closureSchema = z
  .object({
    barber_id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Invalid barber"),
    start_date: z.string().regex(dateRe, "Invalid date"),
    end_date: z.string().regex(dateRe, "Invalid date"),
    reason: optText,
  })
  .refine((c) => c.end_date >= c.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });

// Convert FormData to a plain object (all values as strings).
export function formToObject(formData) {
  const obj = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return obj;
}

// Validate; return { data } or { fieldErrors } (flattened from Zod).
export function safeValidate(schema, obj) {
  const result = schema.safeParse(obj);
  if (result.success) return { data: result.data };
  return { fieldErrors: result.error.flatten().fieldErrors };
}
