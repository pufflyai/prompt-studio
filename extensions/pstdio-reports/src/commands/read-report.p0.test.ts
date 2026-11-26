import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { reportsCollection } from "../data/collections";
import { makeCommandContext } from "./command-context.fixture";
import { readReportCommand } from "./read-report";
import { saveReportCommand } from "./save-report";
import { writeReportCommand } from "./write-report";

const setup = () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  const ctx = makeCommandContext({ storage, params: {}, overrides: { projectFiles } });
  const write = () => writeReportCommand.run(ctx, { kind: "review", template: "review" });
  return { storage, ctx, write };
};

test("report reads follow core renumbering without saving a second copy of the number", async () => {
  const { storage, ctx, write } = setup();
  const report = await write();
  expect(report.shorthand).toBe("RP-1");
  expect(await reportsCollection(storage).get(report.reportId)).not.toHaveProperty("shorthand");
  ctx.resources.identity = async () => ({
    id: report.reportId,
    kind: "report",
    shorthand: "RP-2",
    aliases: ["RP-1"],
  });
  expect(await readReportCommand.run(ctx, { id: report.reportId })).toMatchObject({
    id: report.reportId,
    shorthand: "RP-2",
    aliases: ["RP-1"],
    body: expect.any(String),
  });
  await saveReportCommand.run(ctx, { name: report.name });
  expect(await readReportCommand.run(ctx, { id: report.reportId })).toMatchObject({ shorthand: "RP-2" });
});

test("a report's old number resolves through core aliases", async () => {
  const { ctx, write } = setup();
  const report = await write();
  ctx.resources.findByShorthand = async ({ kind, shorthand }) => {
    expect(kind).toBe("report");
    expect(shorthand).toBe("RP-1");
    return [{ id: report.reportId, kind, shorthand: "RP-2", aliases: ["RP-1"] }];
  };
  expect(await readReportCommand.run(ctx, { id: " rp-1 " })).toMatchObject({
    id: report.reportId,
    shorthand: "RP-2",
    body: expect.any(String),
  });
});

test("an existing report uses core's current number and drops its old copy on save", async () => {
  const { storage, ctx, write } = setup();
  const report = await write();
  const collection = reportsCollection(storage);
  const stored = (await collection.get(report.reportId))!;
  await collection.put(report.reportId, { ...stored, shorthand: "RP-99" } as typeof stored);
  expect(await readReportCommand.run(ctx, { id: report.reportId })).toMatchObject({ shorthand: "RP-1" });
  await saveReportCommand.run(ctx, { name: report.name });
  expect(await collection.get(report.reportId)).not.toHaveProperty("shorthand");
});

test("a shared report number returns every matching report in core order", async () => {
  const { ctx, write } = setup();
  const first = await write();
  const second = await write();
  ctx.resources.findByShorthand = async () => [
    { id: first.reportId, kind: "report", shorthand: "RP-1", aliases: [] },
    { id: second.reportId, kind: "report", shorthand: "RP-3", aliases: ["RP-1"] },
  ];
  expect(await readReportCommand.run(ctx, { id: "RP-1" })).toMatchObject([
    { id: first.reportId, shorthand: "RP-1", body: expect.any(String) },
    { id: second.reportId, shorthand: "RP-3", aliases: ["RP-1"], body: expect.any(String) },
  ]);
});

test("core aliases pointing to a report not yet synced do not hide a readable report", async () => {
  const { ctx, write } = setup();
  const report = await write();
  ctx.resources.findByShorthand = async () => [
    { id: "not-yet-synced", kind: "report", shorthand: "RP-1", aliases: [] },
    { id: report.reportId, kind: "report", shorthand: "RP-2", aliases: ["RP-1"] },
  ];
  expect(await readReportCommand.run(ctx, { id: "RP-1" })).toMatchObject({
    id: report.reportId,
    shorthand: "RP-2",
  });
});
