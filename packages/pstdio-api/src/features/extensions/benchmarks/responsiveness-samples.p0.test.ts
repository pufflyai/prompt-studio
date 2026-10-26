import { expect, test } from "bun:test";
import { summarizeProbeSamples } from "./responsiveness-samples";

test("keeps requests stalled beyond the work window in latency statistics", () => {
  const result = summarizeProbeSamples(
    [
      { startedAt: 90, endedAt: 95, ok: true, status: 200 },
      { startedAt: 110, endedAt: 115, ok: true, status: 200 },
      { startedAt: 120, endedAt: 1200, ok: true, status: 200 },
      { startedAt: 130, endedAt: 140, ok: false, status: 500 },
    ],
    { startedAt: 100, endedAt: 200 },
  );
  expect(result).toEqual({ count: 3, errors: 1, completedDuringWork: 1, p95Ms: 1080, maxMs: 1080 });
});

test("reports missing observations without treating them as zero latency", () => {
  expect(summarizeProbeSamples([], { startedAt: 100, endedAt: 200 })).toEqual({
    count: 0,
    errors: 0,
    completedDuringWork: 0,
    p95Ms: null,
    maxMs: null,
  });
});
