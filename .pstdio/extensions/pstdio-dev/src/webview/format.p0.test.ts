import { describe, expect, test } from "bun:test";
import { formatValue, verdictText } from "./format";

describe("benchmark value formatting", () => {
  test("picks a readable unit for each metric kind", () => {
    expect(formatValue(5400, "ms")).toBe("5.40 s");
    expect(formatValue(305, "ms")).toBe("305 ms");
    expect(formatValue(0.37, "ms")).toBe("0.370 ms");
    expect(formatValue(0.0085, "share")).toBe("0.85%");
    expect(formatValue(1_215_004_672, "bytes")).toBe("1.2 GB");
    expect(formatValue(29_937_324, "bytes")).toBe("29.9 MB");
  });

  test("names memory changes by direction, not speed", () => {
    const change = { change: 0.12, low: 0.05, high: 0.2, verdict: "regressed" as const };
    expect(verdictText(change, "ms")).toBe("↑ 12.0% slower");
    expect(verdictText(change, "bytes")).toBe("↑ 12.0% more memory");
    expect(verdictText({ ...change, verdict: "unchanged" }, "bytes")).toBe("≈ no change");
  });
});
