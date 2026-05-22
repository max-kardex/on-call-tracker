import { isWeekend, isSameDay, startOfDay } from "date-fns";

/**
 * Represents a holiday with a date and name.
 */
export interface HolidayEntry {
  date: Date;
  name: string;
}

/**
 * Computes US federal holidays for a given year.
 * Includes: New Year's Day, MLK Day, Presidents' Day, Memorial Day,
 * Independence Day (Juneteenth), Independence Day (July 4th), Labor Day,
 * Columbus Day, Veterans Day, Thanksgiving, Christmas.
 */
export function getUSFederalHolidays(year: number): HolidayEntry[] {
  return [
    { date: new Date(year, 0, 1), name: "New Year's Day" },
    { date: nthWeekday(year, 0, 1, 3), name: "Martin Luther King Jr. Day" }, // 3rd Monday in Jan
    { date: nthWeekday(year, 1, 1, 3), name: "Presidents' Day" }, // 3rd Monday in Feb
    { date: lastWeekday(year, 4, 1), name: "Memorial Day" }, // Last Monday in May
    { date: new Date(year, 5, 19), name: "Juneteenth" },
    { date: new Date(year, 6, 4), name: "Independence Day" },
    { date: nthWeekday(year, 8, 1, 1), name: "Labor Day" }, // 1st Monday in Sep
    { date: nthWeekday(year, 9, 1, 2), name: "Columbus Day" }, // 2nd Monday in Oct
    { date: new Date(year, 10, 11), name: "Veterans Day" },
    { date: nthWeekday(year, 10, 4, 4), name: "Thanksgiving" }, // 4th Thursday in Nov
    { date: new Date(year, 11, 25), name: "Christmas Day" },
  ];
}

/**
 * Checks if a given date is a weekend (Saturday or Sunday).
 */
export function isWeekendDay(date: Date): boolean {
  return isWeekend(date);
}

/**
 * Checks if a given date is a holiday (in the provided list).
 */
export function isHolidayDate(date: Date, holidays: HolidayEntry[]): boolean {
  const day = startOfDay(date);
  return holidays.some((h) => isSameDay(startOfDay(h.date), day));
}

/**
 * Checks if a given date is a weekend or a holiday.
 */
export function isWeekendOrHoliday(date: Date, holidays: HolidayEntry[]): boolean {
  return isWeekendDay(date) || isHolidayDate(date, holidays);
}

/**
 * Gets all holidays (US federal + custom from DB) for a date range.
 * Custom holidays should be passed in from the caller (fetched from DB).
 */
export function getAllHolidays(
  startDate: Date,
  endDate: Date,
  customHolidays: HolidayEntry[] = []
): HolidayEntry[] {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  const federalHolidays: HolidayEntry[] = [];
  for (let year = startYear; year <= endYear; year++) {
    federalHolidays.push(...getUSFederalHolidays(year));
  }

  // Combine and deduplicate (custom overrides federal if same date)
  const allHolidays = [...federalHolidays, ...customHolidays];
  return allHolidays;
}

/**
 * Calculates PTO hours for a single call.
 *
 * Formula:
 *   call_base = ceil(duration_minutes / 60)  — 1 PTO hour per started hour
 *   time_mult = holiday ? holidayMult : weekend ? weekendMult : 1
 *               (holiday takes precedence over weekend, no stacking)
 *   sev_mult  = configured per severity (default 1)
 *   call_pto  = call_base * time_mult * sev_mult
 */
export function calculateCallPto(
  durationMinutes: number,
  startTime: Date,
  severity: string,
  severityMultipliers: Record<string, number>,
  holidays: HolidayEntry[],
  weekendMult: number = 2,
  holidayMult: number = 2
): { pto: number; callBase: number; timeMult: number; sevMult: number; dayType: "weekday" | "weekend" | "holiday" } {
  const callBase = Math.ceil(durationMinutes / 60);

  // Holiday takes precedence over weekend
  let timeMult = 1;
  let dayType: "weekday" | "weekend" | "holiday" = "weekday";
  if (isHolidayDate(startTime, holidays)) {
    timeMult = holidayMult;
    dayType = "holiday";
  } else if (isWeekendDay(startTime)) {
    timeMult = weekendMult;
    dayType = "weekend";
  }

  const sevMult = severityMultipliers[severity] ?? 1;
  const pto = callBase * timeMult * sevMult;

  return { pto, callBase, timeMult, sevMult, dayType };
}

// ─── Helper functions for date computation ───────────────────────────────────

/**
 * Returns the nth occurrence of a weekday in a given month/year.
 * @param year - Full year
 * @param month - Month (0-indexed: 0=Jan, 11=Dec)
 * @param weekday - Day of week (0=Sun, 1=Mon, ..., 6=Sat)
 * @param n - Which occurrence (1=first, 2=second, etc.)
 */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  let offset = weekday - firstDayOfWeek;
  if (offset < 0) offset += 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(year, month, day);
}

/**
 * Returns the last occurrence of a weekday in a given month/year.
 * @param year - Full year
 * @param month - Month (0-indexed)
 * @param weekday - Day of week (0=Sun, 1=Mon, ..., 6=Sat)
 */
function lastWeekday(year: number, month: number, weekday: number): Date {
  // Start from the last day of the month and work backwards
  const lastDay = new Date(year, month + 1, 0);
  const lastDayOfWeek = lastDay.getDay();
  let offset = lastDayOfWeek - weekday;
  if (offset < 0) offset += 7;
  return new Date(year, month, lastDay.getDate() - offset);
}
