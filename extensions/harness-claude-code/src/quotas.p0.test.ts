import { expect, test } from "bun:test";
import { normalizeClaudeQuotas } from "./quotas";

test("Claude reports subscription windows without treating missing utilization as zero", () => {
  const result = normalizeClaudeQuotas({
    rate_limits: {
      five_hour: { utilization: 100, resets_at: "2026-11-10T18:00:00Z" },
      seven_day: { utilization: 25, resets_at: "2026-11-15T18:00:00Z" },
      seven_day_sonnet: null,
    },
  });
  expect(result.status).toBe("available");
  expect(result.limits.map((limit) => limit.remainingPercent)).toEqual([0, 75]);
  expect(result.limits[0]?.resetsAt).toBe("2026-11-10T18:00:00.000Z");
  expect(normalizeClaudeQuotas({ rate_limits_available: false, rate_limits: null }).status).toBe("unavailable");
});

test("Claude preserves model-specific weekly allowances", () => {
  const result = normalizeClaudeQuotas({
    rate_limits: {
      model_scoped: [
        { display_name: "Fable", utilization: 30, resets_at: "2026-11-15T18:00:00Z" },
        { display_name: "Other model", utilization: null, resets_at: null },
      ],
    },
  });
  expect(result.limits).toHaveLength(1);
  expect(result.limits[0]?.label).toBe("Fable weekly");
  expect(result.limits[0]?.remainingPercent).toBe(70);
});
