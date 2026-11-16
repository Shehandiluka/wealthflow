import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a Date as a "YYYY-MM-DD" string using its LOCAL calendar date —
 * not `.toISOString().split("T")[0]`, which converts to UTC first and
 * silently shifts the date backward by a day for anyone in a positive UTC
 * offset (Sri Lanka +5:30, Israel +2/+3 — this app's actual users). That bug
 * is why a transaction dated locally on Aug 31 could show up under a
 * "September" filter: the month-boundary itself was computed one day early.
 */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Same local-timezone reasoning as toLocalISODate, but for "YYYY-MM" month keys. */
export function toLocalYearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
