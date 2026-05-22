import { describe, it, expect } from "vitest";
import {
  getUSFederalHolidays,
  isWeekendDay,
  isHolidayDate,
  isWeekendOrHoliday,
  getAllHolidays,
  calculateCallPto,
  type HolidayEntry,
} from "@/lib/holidays";

describe("getUSFederalHolidays", () => {
  it("returns 11 federal holidays for a year", () => {
    const holidays = getUSFederalHolidays(2026);
    expect(holidays).toHaveLength(11);
  });

  it("returns correct New Year's Day", () => {
    const holidays = getUSFederalHolidays(2026);
    const newYear = holidays.find((h) => h.name === "New Year's Day");
    expect(newYear).toBeDefined();
    expect(newYear!.date.getMonth()).toBe(0);
    expect(newYear!.date.getDate()).toBe(1);
  });

  it("computes MLK Day (3rd Monday in Jan) correctly for 2026", () => {
    const holidays = getUSFederalHolidays(2026);
    const mlk = holidays.find((h) => h.name === "Martin Luther King Jr. Day");
    expect(mlk).toBeDefined();
    // 2026: Jan 1 is Thursday, so first Monday is Jan 5, third Monday is Jan 19
    expect(mlk!.date.getDate()).toBe(19);
    expect(mlk!.date.getDay()).toBe(1); // Monday
  });

  it("computes Memorial Day (last Monday in May) correctly for 2026", () => {
    const holidays = getUSFederalHolidays(2026);
    const memorial = holidays.find((h) => h.name === "Memorial Day");
    expect(memorial).toBeDefined();
    // 2026: May 25 is Monday (last Monday)
    expect(memorial!.date.getDate()).toBe(25);
    expect(memorial!.date.getDay()).toBe(1); // Monday
  });

  it("computes Labor Day (1st Monday in Sep) correctly for 2026", () => {
    const holidays = getUSFederalHolidays(2026);
    const labor = holidays.find((h) => h.name === "Labor Day");
    expect(labor).toBeDefined();
    // 2026: Sep 1 is Tuesday, first Monday is Sep 7
    expect(labor!.date.getDate()).toBe(7);
    expect(labor!.date.getDay()).toBe(1);
  });

  it("computes Thanksgiving (4th Thursday in Nov) correctly for 2026", () => {
    const holidays = getUSFederalHolidays(2026);
    const tg = holidays.find((h) => h.name === "Thanksgiving");
    expect(tg).toBeDefined();
    // 2026: Nov 1 is Sunday, first Thursday is Nov 5, fourth is Nov 26
    expect(tg!.date.getDate()).toBe(26);
    expect(tg!.date.getDay()).toBe(4); // Thursday
  });

  it("includes Independence Day (July 4)", () => {
    const holidays = getUSFederalHolidays(2026);
    const july4 = holidays.find((h) => h.name === "Independence Day");
    expect(july4).toBeDefined();
    expect(july4!.date.getMonth()).toBe(6);
    expect(july4!.date.getDate()).toBe(4);
  });

  it("includes Juneteenth (June 19)", () => {
    const holidays = getUSFederalHolidays(2026);
    const juneteenth = holidays.find((h) => h.name === "Juneteenth");
    expect(juneteenth).toBeDefined();
    expect(juneteenth!.date.getMonth()).toBe(5);
    expect(juneteenth!.date.getDate()).toBe(19);
  });
});

describe("isWeekendDay", () => {
  it("returns true for Saturday", () => {
    expect(isWeekendDay(new Date("2026-06-06T12:00:00"))).toBe(true); // Saturday
  });

  it("returns true for Sunday", () => {
    expect(isWeekendDay(new Date("2026-06-07T12:00:00"))).toBe(true); // Sunday
  });

  it("returns false for Monday-Friday", () => {
    expect(isWeekendDay(new Date("2026-06-01T12:00:00"))).toBe(false); // Monday
    expect(isWeekendDay(new Date("2026-06-03T12:00:00"))).toBe(false); // Wednesday
    expect(isWeekendDay(new Date("2026-06-05T12:00:00"))).toBe(false); // Friday
  });
});

describe("isHolidayDate", () => {
  const holidays: HolidayEntry[] = [
    { date: new Date("2026-07-04T12:00:00"), name: "Independence Day" },
    { date: new Date("2026-12-25T12:00:00"), name: "Christmas" },
  ];

  it("returns true for a date that matches a holiday", () => {
    expect(isHolidayDate(new Date("2026-07-04T08:30:00"), holidays)).toBe(true);
  });

  it("returns false for a date that does not match", () => {
    expect(isHolidayDate(new Date("2026-07-05T08:30:00"), holidays)).toBe(false);
  });

  it("matches regardless of time-of-day", () => {
    expect(isHolidayDate(new Date("2026-12-25T23:59:00"), holidays)).toBe(true);
  });
});

describe("isWeekendOrHoliday", () => {
  const holidays: HolidayEntry[] = [
    { date: new Date("2026-06-10T12:00:00"), name: "Company Day" }, // Wednesday
  ];

  it("returns true for weekend", () => {
    expect(isWeekendOrHoliday(new Date("2026-06-06T12:00:00"), holidays)).toBe(true);
  });

  it("returns true for holiday on a weekday", () => {
    expect(isWeekendOrHoliday(new Date("2026-06-10T09:00:00"), holidays)).toBe(true);
  });

  it("returns false for regular weekday", () => {
    expect(isWeekendOrHoliday(new Date("2026-06-03T09:00:00"), holidays)).toBe(false);
  });
});

describe("getAllHolidays", () => {
  it("combines federal and custom holidays", () => {
    const custom: HolidayEntry[] = [
      { date: new Date("2026-03-15T12:00:00"), name: "Company Anniversary" },
    ];
    const all = getAllHolidays(new Date("2026-01-01T12:00:00"), new Date("2026-12-31T12:00:00"), custom);

    // Should have 11 federal + 1 custom = 12
    expect(all.length).toBe(12);
    expect(all.some((h) => h.name === "Company Anniversary")).toBe(true);
    expect(all.some((h) => h.name === "Christmas Day")).toBe(true);
  });

  it("spans multiple years if range crosses year boundary", () => {
    const all = getAllHolidays(new Date("2025-12-01T12:00:00"), new Date("2026-01-31T12:00:00"), []);
    // Should have holidays from 2025 and 2026
    const newYears = all.filter((h) => h.name === "New Year's Day");
    expect(newYears.length).toBe(2); // One for 2025, one for 2026
  });
});

describe("calculateCallPto", () => {
  const holidays: HolidayEntry[] = [
    { date: new Date("2026-06-19T12:00:00"), name: "Juneteenth" },
  ];
  const severityMultipliers = { P1: 2, P2: 1.5, P3: 1, P4: 1 };

  it("short weekday P1 call: 1 * 1 * 2 = 2", () => {
    const result = calculateCallPto(
      45, // 45 min
      new Date("2026-06-03T14:00:00"), // Wednesday
      "P1",
      severityMultipliers,
      holidays
    );
    expect(result.callBase).toBe(1);
    expect(result.timeMult).toBe(1);
    expect(result.sevMult).toBe(2);
    expect(result.pto).toBe(2);
  });

  it("long weekend P2 call: 2 * 2 * 1.5 = 6", () => {
    const result = calculateCallPto(
      90, // 90 min
      new Date("2026-06-06T03:00:00"), // Saturday
      "P2",
      severityMultipliers,
      holidays
    );
    expect(result.callBase).toBe(2);
    expect(result.timeMult).toBe(2);
    expect(result.sevMult).toBe(1.5);
    expect(result.pto).toBe(6);
  });

  it("short holiday P3 call: 1 * 2 * 1 = 2", () => {
    const result = calculateCallPto(
      30,
      new Date("2026-06-19T10:00:00"), // Juneteenth (Friday)
      "P3",
      severityMultipliers,
      holidays
    );
    expect(result.callBase).toBe(1);
    expect(result.timeMult).toBe(2);
    expect(result.sevMult).toBe(1);
    expect(result.pto).toBe(2);
  });

  it("exactly 60 min counts as 1h base (not 2)", () => {
    const result = calculateCallPto(
      60,
      new Date("2026-06-03T10:00:00"), // Wednesday
      "P3",
      severityMultipliers,
      holidays
    );
    expect(result.callBase).toBe(1);
  });

  it("61 min counts as 2h base", () => {
    const result = calculateCallPto(
      61,
      new Date("2026-06-03T10:00:00"),
      "P3",
      severityMultipliers,
      holidays
    );
    expect(result.callBase).toBe(2);
  });

  it("defaults severity multiplier to 1 when not configured", () => {
    const result = calculateCallPto(
      30,
      new Date("2026-06-03T10:00:00"),
      "P1",
      {}, // no multipliers configured
      holidays
    );
    expect(result.sevMult).toBe(1);
    expect(result.pto).toBe(1);
  });
});
