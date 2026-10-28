import { expect, test } from "bun:test";
import { buildAnalysis } from "./analysis";
import { foundThread } from "./commands/test-context";
import type { FoundThread } from "./schemas";

test("mention totals and daily points cover the same calendar days", () => {
  const now = new Date(2026, 9, 3, 12).getTime();
  const mention = (id: string, date: Date): FoundThread => ({
    ...foundThread("run"),
    id,
    status: "new",
    mention: true,
    foundAt: date.toISOString(),
  });
  const result = buildAnalysis({
    now,
    days: 14,
    threads: [mention("earlier", new Date(2026, 8, 19, 18)), mention("first", new Date(2026, 8, 20, 0))],
  });
  expect(result.mentions).toEqual({ count: 1, change: 0 });
  expect(result.mentionsPerDay[0].count).toBe(1);
  expect(result.mentionsPerDay.reduce((total, point) => total + point.count, 0)).toBe(result.mentions.count);
});
