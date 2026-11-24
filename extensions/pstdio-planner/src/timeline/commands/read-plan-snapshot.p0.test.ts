import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../../commands/command-context.fixture";
import { putTag } from "../../data/collections";
import { readTagDefinitions } from "../../data/definition-query";
import { putTicket } from "../../data/ticket-context.fixture";
import { ticketRecords } from "../../data/ticket-records";
import { addDays } from "../model/days";
import { planPlacements, writePlanMetadata } from "./placement-store";
import { readPlanCommand } from "./read-plan";

const fixture = async () => {
  const storage = createMemoryStorage();
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const deadline = { id: "deadline", date: addDays(today, -1) };
  await writePlanMetadata(storage, { deadlines: [deadline] });
  await putTicket(storage, {
    id: "placed",
    shorthand: "T-1",
    title: "Placed",
    content: "",
    statusId: "ready",
    archived: false,
    createdAt: "before",
    updatedAt: "after",
  });
  await putTicket(storage, {
    id: "pending",
    shorthand: "T-2",
    title: "Pending",
    content: "",
    statusId: "ready",
    archived: false,
    createdAt: "before",
    updatedAt: "after",
  });
  await planPlacements(storage).put("placed", { ticketId: "placed", deadlineId: deadline.id, position: "a" });
  return { storage, today, deadline, ctx: makeCommandContext({ storage, params: {} }) };
};

test("a deadline moved to the future during initialization is visible in the returned plan", async () => {
  const { storage, ctx, deadline, today } = await fixture();
  const commit = storage.records.commit;
  let edited = false;
  storage.records.commit = async (request) => {
    const result = await commit(request);
    if (!edited && (await planPlacements(storage).get("pending"))) {
      edited = true;
      await writePlanMetadata(storage, { deadlines: [{ ...deadline, date: addDays(today, 1) }] });
    }
    return result;
  };
  const result = await readPlanCommand.run(ctx, { display: { showPassedMilestones: false } });
  expect(edited).toBe(true);
  expect(result.sections.find(({ deadline: d }) => d?.id === deadline.id)?.rows.map(({ id }) => id)).toEqual([
    "placed",
  ]);
  expect(result.sections.find(({ deadline: d }) => d?.id === deadline.id)?.deadline?.date).toBe(addDays(today, 1));
});

test("a deadline edit after the query snapshot rejects the stale visibility filter", async () => {
  const { storage, ctx, deadline, today } = await fixture();
  await readPlanCommand.run(ctx, {});
  const query = storage.records.query;
  let edited = false;
  storage.records.query = async (request) => {
    const result = await query(request);
    if (!edited && request.index === "ticket-view" && request.limit === 0) {
      edited = true;
      await writePlanMetadata(storage, { deadlines: [{ ...deadline, date: addDays(today, 1) }] });
    }
    return result;
  };
  await expect(readPlanCommand.run(ctx, { display: { showPassedMilestones: false } })).rejects.toThrow("stale");
  expect(edited).toBe(true);
});

test.each([
  false,
  true,
])("Timeline prepares existing property definitions once (collapsed tracks: %s)", async (collapsed) => {
  const display = collapsed ? { collapsedTracks: ["unused"] } : undefined;
  const { storage, ctx } = await fixture();
  await readPlanCommand.run(ctx, {});
  const query = storage.records.query;
  let reads = 0;
  storage.records.query = async (request) => {
    if (request.index === "definitions:ticket-tags") reads++;
    return query(request);
  };
  const result = await readPlanCommand.run(ctx, { display });
  expect(result.tags.length).toBeGreaterThan(0);
  expect(reads).toBe(1);
});

test("track options and the page mapping include a tag edit during placement initialization", async () => {
  const { storage, ctx } = await fixture();
  const option = (id: string) => ({ id, name: id, color: "gray", sortOrder: 0, icon: null, description: null });
  const track = { id: "track", name: "Track", type: "single_select" as const, sortOrder: 0, options: [option("old")] };
  await putTag(storage, track);
  await storage.set("timeline.track-property-id", track.id);
  const placed = (await ticketRecords(storage).get("placed"))!;
  await ticketRecords(storage).put("placed", { ...placed, tags: { track: ["old"] } });
  const commit = storage.records.commit;
  let edited = false;
  storage.records.commit = async (request) => {
    const result = await commit(request);
    if (!edited && (await planPlacements(storage).get("pending"))) {
      edited = true;
      await putTag(storage, { ...track, options: [option("new")] });
      await ticketRecords(storage).put("placed", { ...placed, tags: { track: ["new"] } });
    }
    return result;
  };
  const result = await readPlanCommand.run(ctx, { display: { collapsedTracks: ["unassigned"] } });
  expect(edited).toBe(true);
  expect(result.sections.flatMap(({ rows }) => rows).map(({ id, trackId }) => ({ id, trackId }))).toEqual([
    { id: "placed", trackId: "new" },
  ]);
  expect(result.tags.find(({ id }) => id === track.id)?.options.map(({ id }) => id)).toEqual(["new"]);
});

test("a tag definition edit after the query snapshot rejects the stale page mapping", async () => {
  const { storage, ctx } = await fixture();
  await readPlanCommand.run(ctx, {});
  const [tag] = await readTagDefinitions(storage);
  const query = storage.records.query;
  let edited = false;
  storage.records.query = async (request) => {
    const result = await query(request);
    if (!edited && request.index === "definitions:ticket-tags") {
      edited = true;
      await putTag(storage, { ...tag, name: "Changed during the read" });
    }
    return result;
  };
  await expect(readPlanCommand.run(ctx, {})).rejects.toThrow("stale");
  expect(edited).toBe(true);
});
