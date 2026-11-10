import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { quotaSeries, saveQuotaHistory } from "./quota-history";
import type { QuotaReport } from "./quotas";

const resetsAt = "2026-11-16T00:00:00Z";
const report = (checkedAt: string, remainingPercent: number, reset = resetsAt): QuotaReport => ({
  id: "codex",
  label: "Codex",
  status: "available",
  checkedAt,
  limits: [{ id: "weekly", label: "Weekly", remainingPercent, resetsAt: reset, windowMinutes: 10080 }],
});
const save = (storage: ReturnType<typeof createMemoryStorage>, reports: QuotaReport[]) =>
  saveQuotaHistory(storage, reports, Date.parse(reports[0]!.checkedAt));

test("quota history survives later reads, keeps the latest hourly reading, and separates reset weeks", async () => {
  const storage = createMemoryStorage();
  await save(storage, [report("2026-11-10T00:10:00Z", 90)]);
  await save(storage, [report("2026-11-10T00:30:00Z", 85)]);
  const [latest] = await save(storage, [report("2026-11-10T01:00:00Z", 75)]);
  expect(latest?.limits[0]?.history).toEqual([
    { at: "2026-11-10T00:30:00Z", usedPercent: 15 },
    { at: "2026-11-10T01:00:00Z", usedPercent: 25 },
  ]);
  const [nextWeek] = await save(storage, [report("2026-11-16T00:05:00Z", 99, "2026-11-23T00:00:00Z")]);
  expect(nextWeek?.limits[0]?.history).toHaveLength(1);
  await save(storage, [report("2026-11-19T01:00:00Z", 80, "2026-11-23T00:00:00Z")]);
  expect((await storage.records.list()).some((record) => JSON.stringify(record.value).includes("2026-11-10"))).toBe(
    false,
  );
  expect((await storage.records.list()).length).toBe(2);
});

test("weekly charts use native period bounds, connect a first reading from zero, and forecast past the limit", () => {
  const current = report("2026-11-10T18:00:00Z", 50);
  const series = quotaSeries(current.limits[0]!, current.checkedAt);
  expect(series.start).toBe(Date.parse("2026-11-09T00:00:00Z"));
  expect(series.end).toBe(Date.parse(resetsAt));
  expect(series.forecast.at(-1)?.used).toBe(200);
  expect(series.history).toEqual([
    { time: series.start, used: 0 },
    { time: Date.parse(current.checkedAt), used: 50 },
  ]);
});

test("overlapping checks cannot replace a newer hourly observation with an older one", async () => {
  const storage = createMemoryStorage();
  const commit = storage.records.commit.bind(storage.records);
  const newerCommitted = Promise.withResolvers<void>();
  storage.records.commit = async (group) => {
    const text = JSON.stringify(group.edits);
    if (text.includes("2026-11-10T00:10:00Z")) await newerCommitted.promise;
    const outcome = await commit(group);
    if (text.includes("2026-11-10T00:30:00Z")) newerCommitted.resolve();
    return outcome;
  };
  await Promise.all([
    save(storage, [report("2026-11-10T00:10:00Z", 90)]),
    save(storage, [report("2026-11-10T00:30:00Z", 85)]),
  ]);
  const records = await storage.records.list();
  expect(records).toHaveLength(1);
  expect(records[0]?.value).toMatchObject({ at: "2026-11-10T00:30:00Z", usedPercent: 15 });
});

test("a single unknown-period reading starts at zero; expired periods do not forecast", () => {
  const unknown = quotaSeries({ id: "budget", label: "Budget", remainingPercent: 75 }, "2026-11-10T12:00:00Z");
  expect(unknown.forecast).toEqual([]);
  expect(unknown.history).toEqual([
    { time: unknown.start, used: 0 },
    { time: Date.parse("2026-11-10T12:00:00Z"), used: 25 },
  ]);
  const current = report("2026-11-16T01:00:00Z", 0);
  expect(quotaSeries(current.limits[0]!, current.checkedAt).forecast).toEqual([]);
});

test("multiple observed readings retain their history without a zero anchor", () => {
  const current = report("2026-11-10T18:00:00Z", 50);
  current.limits[0]!.history = [{ at: "2026-11-10T12:00:00Z", usedPercent: 30 }];
  expect(quotaSeries(current.limits[0]!, current.checkedAt).history).toEqual([
    { time: Date.parse("2026-11-10T12:00:00Z"), used: 30 },
    { time: Date.parse(current.checkedAt), used: 50 },
  ]);
});
