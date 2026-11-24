import { expect, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import type { CommandContext } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../../commands/command-context.fixture";
import { putTicket } from "../../data/ticket-context.fixture";
import { initializePlanPlacements } from "./initialize-placements";
import { readPlanMetadata } from "./placement-store";
import { readPlanCommand } from "./read-plan";

const fixture = async (count: number) => {
  const storage = createMemoryStorage();
  const ids = Array.from({ length: count }, (_, index) => String(index));
  let position: string | undefined;
  for (const id of ids) {
    position = storage.positions.between(position);
    await putTicket(storage, {
      id,
      shorthand: `T-${id}`,
      title: `Ticket ${id}`,
      content: "",
      archived: false,
      statusId: "ready",
      sortOrder: Number(id),
      createdAt: "before",
      updatedAt: "after",
      position,
    });
  }
  const ctx = makeCommandContext({ storage, params: {} });
  const peer = { ...ctx, storage: { ...storage, records: { ...storage.records } } };
  await readPlanMetadata(storage);
  await readPlanMetadata(peer.storage);
  return { ctx, peer, ids };
};

const readOrder = async (ctx: CommandContext, count: number) => {
  const ordered: string[] = [];
  for (let offset = 0; offset < count; offset += 100) {
    const page = await readPlanCommand.run(ctx, { page: { limit: 100, offset, fields: ["id"], search: "" } });
    ordered.push(...page.sections.flatMap(({ rows }) => rows.map(({ id }) => id)));
  }
  return ordered;
};

test("concurrent Timeline initialization preserves execution order across placement batches", async () => {
  const { ctx, peer, ids } = await fixture(203);
  const storage = ctx.storage;
  const readers = new AsyncLocalStorage<"first" | "second">();
  const firstTail = Promise.withResolvers<void>();
  const resumeFirst = Promise.withResolvers<void>();
  const firstBatch = Promise.withResolvers<void>();
  const secondBatch = Promise.withResolvers<void>();
  let firstCommitted = false;
  let secondCapturedEmptyTail = false;
  const query = storage.records.query;
  const heldQuery: typeof query = async (request) => {
    const reader = readers.getStore();
    if (reader === "first" && request.index === "ticket-view" && firstCommitted && secondCapturedEmptyTail)
      await secondBatch.promise;
    const result = await query(request);
    if (request.index === "timeline-placements" && request.limit === 1) {
      if (reader === "first" && !firstCommitted) {
        firstTail.resolve();
        await resumeFirst.promise;
      }
      if (reader === "second" && !result.records.length) {
        secondCapturedEmptyTail = true;
        // Its later pending batch must observe the first reader's committed prefix.
        await firstBatch.promise;
      }
    }
    return result;
  };
  storage.records.query = heldQuery;
  peer.storage.records.query = heldQuery;
  const commit = storage.records.commit;
  const observedCommit: typeof commit = async (request) => {
    const result = await commit(request);
    const { count } = await storage.records.aggregate({ index: "timeline-placements" });
    if (count >= 100) {
      firstCommitted = true;
      firstBatch.resolve();
    }
    if (count > 100) secondBatch.resolve();
    return result;
  };
  storage.records.commit = observedCommit;
  peer.storage.records.commit = observedCommit;

  const first = readers.run("first", () => initializePlanPlacements(ctx, ["done"]));
  await firstTail.promise;
  const second = readers.run("second", () => initializePlanPlacements(peer, ["done"]));
  // Drain the second memory-backed request while the first tail is held.
  await new Promise<void>((resolve) => setImmediate(resolve));
  resumeFirst.resolve();
  await Promise.all([first, second]);
  expect(await readOrder(ctx, ids.length)).toEqual(ids);
});

test("a queued Timeline initializer completes after its peer rejects a committed batch", async () => {
  const { ctx, peer, ids } = await fixture(103);
  const commit = ctx.storage.records.commit;
  let rejected = false;
  const interruptedCommit: typeof commit = async (request) => {
    const result = await commit(request);
    const { count } = await ctx.storage.records.aggregate({ index: "timeline-placements" });
    if (!rejected && count === 100) {
      rejected = true;
      throw new Error("Placement acknowledgement interrupted");
    }
    return result;
  };
  ctx.storage.records.commit = interruptedCommit;
  peer.storage.records.commit = interruptedCommit;
  const failed = initializePlanPlacements(ctx, ["done"]).then(
    () => undefined,
    (error: Error) => error.message,
  );
  const queued = initializePlanPlacements(peer, ["done"]);
  expect(await failed).toBe("Placement acknowledgement interrupted");
  await queued;
  expect(await readOrder(ctx, ids.length)).toEqual(ids);
});
