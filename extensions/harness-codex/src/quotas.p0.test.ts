import { expect, test } from "bun:test";
import { normalizeCodexQuotas } from "./quotas";

test("Codex reports each native quota bucket and preserves an exhausted window", () => {
  const result = normalizeCodexQuotas({
    rateLimitsByLimitId: {
      codex: {
        limitName: "Codex",
        primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1800000000 },
        secondary: { usedPercent: 100, windowDurationMins: 10080 },
      },
      review: { limitName: "Code review", primary: { usedPercent: 8, windowDurationMins: 60 } },
    },
  });
  expect(result.status).toBe("available");
  expect(result.limits.map((limit) => limit.remainingPercent)).toEqual([75, 0, 92]);
  expect(result.limits[0]?.resetsAt).toBe("2027-01-15T08:00:00.000Z");
  expect(result.limits[2]?.label).toContain("Code review");
  expect(result.limits.map((limit) => limit.windowMinutes)).toEqual([300, 10080, 60]);
});

test("Codex supports the native single bucket response and keeps missing limits unknown", () => {
  expect(normalizeCodexQuotas({ rateLimits: { primary: { usedPercent: 40 } } }).limits[0]?.remainingPercent).toBe(60);
  expect(normalizeCodexQuotas({ rateLimits: { primary: { usedPercent: null } } }).status).toBe("unavailable");
  expect(normalizeCodexQuotas({}).limits).toEqual([]);
});
