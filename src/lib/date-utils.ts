import { format } from "date-fns";

/**
 * Parse a YYYY-MM-DD string into a local Date at midnight.
 * Uses "T00:00:00" (no Z) so JavaScript parses it as local time,
 * avoiding the UTC day-shift that occurs with date-only ISO strings.
 */
export function toDisplayDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

/**
 * Format a Date object as a YYYY-MM-DD string in local time.
 * Safe for serializing server-side dates to pass to client components.
 */
export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
