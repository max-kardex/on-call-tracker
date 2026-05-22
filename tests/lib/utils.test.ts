import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conflicting Tailwind classes (last wins)", () => {
    const result = cn("p-4", "p-2");
    expect(result).toBe("p-2");
  });

  it("handles conditional classes", () => {
    const result = cn("base", false && "hidden", "visible");
    expect(result).toBe("base visible");
  });

  it("handles undefined and null inputs", () => {
    const result = cn("foo", undefined, null, "bar");
    expect(result).toBe("foo bar");
  });

  it("handles empty string", () => {
    const result = cn("", "foo");
    expect(result).toBe("foo");
  });

  it("merges conflicting text colors", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("handles array inputs via clsx", () => {
    const result = cn(["foo", "bar"], "baz");
    expect(result).toBe("foo bar baz");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});
