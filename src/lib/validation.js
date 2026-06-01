import { z } from "zod";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export const bookingInputSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  customerName: z.string().trim().min(1, "Name is required").max(120),
  customerPhone: z.string().trim().min(7, "Enter a valid phone number").max(32),
  customerEmail: z.string().trim().email("Enter a valid email"),
  date: z.string().regex(dateRe, "Invalid date"),
  time: z.string().regex(timeRe, "Invalid time"),
});

export const availabilityQuerySchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(dateRe, "Invalid date"),
});
