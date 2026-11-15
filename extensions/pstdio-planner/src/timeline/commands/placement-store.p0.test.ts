import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket, ticketContext } from "../../data/ticket-context.fixture";
import { initializePlanPlacements } from "./initialize-placements";
import { movePlanPlacement, planPlacements, readPlanMetadata } from "./placement-store";

test("migrated placements retain unloaded tickets when one ticket moves", async () => {
  const storage = createMemoryStorage();
  await storage.set("timeline.plan", {
    deadlines: [{ id: "release", date: "2030-01-01" }],
    order: Array.from({ length: 503 }, (_, i) => ({ ticketId: `ticket-${i}`, deadlineId: "release" })),
  });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw new Error(`Unbounded ${name}`);
    },
  });
  storage.records.list = async () => {
    throw new Error("Unbounded record read");
  };
  expect((await readPlanMetadata(storage)).deadlines).toHaveLength(1);
  expect(await storage.get("timeline.plan")).toBeUndefined();
  const first = await planPlacements(storage).get("ticket-0");
  const before = await planPlacements(storage).get("ticket-499");
  await movePlanPlacement(storage, { ticketId: "ticket-502", deadlineId: "release", beforeId: "ticket-499" });
  const moved = await planPlacements(storage).get("ticket-502");
  expect(moved!.position < before!.position).toBe(true);
  expect(await planPlacements(storage).get("ticket-0")).toEqual(first);
  expect((await storage.records.aggregate({ index: "timeline-placements" })).count).toBe(503);
  await movePlanPlacement(storage, { ticketId: "ticket-502", deadlineId: null });
  expect(
    (
      await storage.records.aggregate({
        index: "timeline-placements",
        where: { field: "deadlineId", op: "eq", value: "release" },
      })
    ).count,
  ).toBe(502);
});

test("initial execution placement saves bounded batches instead of a transaction per ticket", async () => {
  const storage = createMemoryStorage();
  ticketContext(storage);
  for (let i = 0; i < 203; i++)
    await putTicket(storage, {
      id: String(i),
      shorthand: `T-${i}`,
      title: String(i),
      content: "",
      archived: false,
      statusId: "ready",
      sortOrder: i,
      createdAt: "before",
      updatedAt: "after",
      position: storage.positions.between(),
    });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    ...(name === "timeline.placements"
      ? {
          createIfAbsent: async () => {
            throw Error("Per-ticket placement save");
          },
        }
      : {}),
  });
  await initializePlanPlacements(storage, ["done"]);
  expect((await storage.records.aggregate({ index: "timeline-placements" })).count).toBe(203);
});

test("initial execution placement batches dependency chains without loading ticket bodies", async () => {
  for (const reverse of [false, true]) {
    const storage = createMemoryStorage();
    ticketContext(storage);
    let position: string | undefined;
    for (let i = 0; i < 100; i++) {
      position = storage.positions.between(position);
      await putTicket(storage, {
        id: String(i),
        shorthand: `T-${i}`,
        title: String(i),
        content: "",
        archived: false,
        statusId: "ready",
        sortOrder: i,
        createdAt: "before",
        updatedAt: "after",
        position,
        dependsOn: i === (reverse ? 99 : 0) ? [] : [String(i + (reverse ? 1 : -1))],
      });
    }
    const commit = storage.records.commit;
    let commits = 0;
    storage.records.commit = async (request) => {
      commits++;
      return commit(request);
    };
    const query = storage.records.query;
    let queries = 0;
    storage.records.query = async (request) => {
      queries++;
      expect(request.limit).toBeLessThanOrEqual(100);
      return query(request);
    };
    await initializePlanPlacements(storage, ["done"]);
    expect(commits).toBe(1);
    expect(queries).toBeLessThanOrEqual(5);
    const rows = await query({ index: "timeline-placements", fields: ["ticketId"], limit: 100 });
    expect(rows.records.map(({ fields }) => fields.ticketId)).toEqual(
      Array.from({ length: 100 }, (_, i) => String(reverse ? 99 - i : i)),
    );
  }
});
