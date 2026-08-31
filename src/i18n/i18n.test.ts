import { describe, it, expect } from "vitest";
import { pickLocale, getDictFor } from "./index";
import { ja } from "./ja";
import { en } from "./en";

describe("pickLocale", () => {
  it("defaults to ja when header is missing", () => {
    expect(pickLocale(null)).toBe("ja");
    expect(pickLocale(undefined)).toBe("ja");
    expect(pickLocale("")).toBe("ja");
  });
  it("returns ja for ja-JP", () => {
    expect(pickLocale("ja-JP,ja;q=0.9,en;q=0.8")).toBe("ja");
  });
  it("returns en when only en is present", () => {
    expect(pickLocale("en-US,en;q=0.9")).toBe("en");
  });
  it("returns ja first when both ja and en have similar priority", () => {
    expect(pickLocale("ja,en")).toBe("ja");
  });
  it("falls back to ja for unknown locales", () => {
    expect(pickLocale("ko-KR,ko;q=0.9")).toBe("ja");
  });
});

describe("getDictFor", () => {
  it("returns ja dictionary for 'ja'", () => {
    expect(getDictFor("ja")).toBe(ja);
  });
  it("returns en dictionary for 'en'", () => {
    expect(getDictFor("en")).toBe(en);
  });
});

describe("dictionary parity", () => {
  function keyset(obj: unknown, prefix = ""): string[] {
    if (typeof obj !== "object" || obj === null) return [];
    const out: string[] = [];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      out.push(path);
      out.push(...keyset(v, path));
    }
    return out.sort();
  }

  it("ja and en have identical key paths", () => {
    expect(keyset(ja)).toEqual(keyset(en));
  });
});
