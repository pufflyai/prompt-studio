import { expect, test } from "bun:test";
import { estimateUsage, monitoringActivity, parseRates, workspaceUsage } from "./workspace-monitoring-data";

const hour = 3_600_000;
const window = { from: 0, to: 2 * hour };

test("integrates controller step counts and exposes partial template rate coverage in every bucket", () => {
  const points = [
    { time: 0, count: 2 },
    { time: hour, count: 1 },
    { time: 2 * hour, count: 0 },
  ];
  const activity = monitoringActivity(
    {
      running: 0,
      peak: 2,
      points,
      byTemplate: [
        {
          template: "preview",
          points: [
            { time: 0, count: 1 },
            { time: 2 * hour, count: 0 },
          ],
        },
      ],
    },
    parseRates({ preview: 0.4 }),
    window,
    2,
  );
  expect(activity.usage).toEqual({ runtimeMs: 3 * hour, costUsd: 0.8, unpricedRuntimeMs: hour });
  expect(activity.buckets.map(({ costUsd, unpricedRuntimeMs }) => [costUsd, unpricedRuntimeMs])).toEqual([
    [0.4, hour],
    [0.4, 0],
  ]);
});

test("reports unavailable prices for retained history without template data and zero for known idle", () => {
  const points = [
    { time: 0, count: 1 },
    { time: hour, count: 0 },
    { time: window.to, count: 0 },
  ];
  const result = monitoringActivity({ running: 0, peak: 1, points }, parseRates({ preview: 0 }), window, 2);
  expect(result.usage).toEqual({ runtimeMs: hour, costUsd: null, unpricedRuntimeMs: hour });
  expect(result.buckets[1].costUsd).toBe(0);
  expect(estimateUsage(hour, 0).costUsd).toBe(0);
});

test("clips runtime to the observation window and distinguishes missing timestamps from never ready", () => {
  const toIso = (time: number) => new Date(time).toISOString();
  expect(workspaceUsage(toIso(-hour), toIso(hour / 2), window, true)).toBe(hour / 2);
  expect(workspaceUsage(toIso(hour), null, window, false)).toBe(hour);
  expect(workspaceUsage(null, toIso(hour), window, true)).toBe(0);
  expect(workspaceUsage(undefined, toIso(hour), window, true)).toBeNull();
  expect(workspaceUsage(toIso(0), null, window, true)).toBeNull();
  expect([...parseRates({ preview: 0, invalid: -1, text: "3" })]).toEqual([["preview", 0]]);
});

test("a configured flat rate prices aggregate activity even on controllers without template attribution", () => {
  const points = [
    { time: 0, count: 2 },
    { time: hour, count: 1 },
    { time: window.to, count: 0 },
  ];
  const activity = { running: 0, peak: 2, points };
  expect(monitoringActivity(activity, parseRates(""), window, 2, 0.5).usage).toEqual({
    runtimeMs: 3 * hour,
    costUsd: 1.5,
    unpricedRuntimeMs: 0,
  });
  expect(monitoringActivity(activity, parseRates('{"preview": 0.2}'), window, 2, 0.5).usage.costUsd).toBeNull();
  expect(workspaceUsage(new Date(window.to + 1).toISOString(), null, window, false)).toBe(0);
});
