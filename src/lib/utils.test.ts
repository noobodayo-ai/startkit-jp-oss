import { describe, it, expect } from "vitest";
import { cn, formatYen, formatDateJP } from "./utils";

describe("cn (className merger)", () => {
  it("joins simple classes", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes Tailwind conflicts via twMerge", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("formatYen", () => {
  it("formats integer with comma separators and yen symbol", () => {
    expect(formatYen(1234567)).toMatch(/￥|¥/);
    expect(formatYen(1234567)).toContain("1,234,567");
  });
});

describe("formatDateJP", () => {
  it("formats Date into YYYY/MM/DD-like 日本語表記", () => {
    const result = formatDateJP(new Date("2026-05-16T00:00:00Z"));
    expect(result).toMatch(/2026/);
  });
});
