import { describe, it, expect } from "vitest";
import { toDisplayDate, toDateString } from "@/lib/date-utils";

describe("date-utils", () => {
  describe("toDisplayDate", () => {
    it("parses YYYY-MM-DD as local midnight", () => {
      const date = toDisplayDate("2026-06-01");
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(5); // June is 5 (0-indexed)
      expect(date.getDate()).toBe(1);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    });

    it("does not shift the day due to UTC offset", () => {
      // Date-only strings like "2026-06-22" are parsed as UTC by spec,
      // which can shift back a day in EST. toDisplayDate should NOT do this.
      const date = toDisplayDate("2026-06-22");
      expect(date.getDate()).toBe(22);
    });

    it("handles December 31 correctly", () => {
      const date = toDisplayDate("2026-12-31");
      expect(date.getMonth()).toBe(11);
      expect(date.getDate()).toBe(31);
      expect(date.getFullYear()).toBe(2026);
    });

    it("handles January 1 correctly", () => {
      const date = toDisplayDate("2027-01-01");
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(1);
      expect(date.getFullYear()).toBe(2027);
    });

    it("handles leap day", () => {
      const date = toDisplayDate("2028-02-29");
      expect(date.getMonth()).toBe(1);
      expect(date.getDate()).toBe(29);
    });
  });

  describe("toDateString", () => {
    it("formats a date as YYYY-MM-DD", () => {
      const date = new Date(2026, 5, 1); // June 1, 2026
      expect(toDateString(date)).toBe("2026-06-01");
    });

    it("pads single-digit months and days", () => {
      const date = new Date(2026, 0, 5); // Jan 5
      expect(toDateString(date)).toBe("2026-01-05");
    });

    it("round-trips with toDisplayDate", () => {
      const original = "2026-08-15";
      const date = toDisplayDate(original);
      const result = toDateString(date);
      expect(result).toBe(original);
    });

    it("formats December 31 correctly", () => {
      const date = new Date(2026, 11, 31);
      expect(toDateString(date)).toBe("2026-12-31");
    });
  });
});
