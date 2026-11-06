import { expect, test } from "bun:test";
import { createMemoryStorageDevices } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { reorderTicket } from "../commands/reorder-ticket";
import { migratePlannerStorage } from "./migrate-storage";
import { readMigratedTickets } from "./read-migrated-tickets";
import { seedTicketIdentity } from "./ticket-context.fixture";

const legacyTicket = (id: string, sortOrder: number) => ({
  id,
  title: id,
  content: "Keep these instructions",
  statusId: "ready",
  archived: false,
  sortOrder,
  createdAt: "2026-11-05T00:00:00Z",
  updatedAt: "2026-11-05T00:00:00Z",
});

test("offline Planner migrations and moves preserve every card in one movable order", async () => {
  const pair = await createMemoryStorageDevices();
  const [first, second] = pair.devices;
  for (const id of ["a", "c", "e"]) {
    await first.collection("tickets").put(id, legacyTicket(id, id.charCodeAt(0)));
  }
  await pair.merge();
  await first.collection("tickets").put("b", legacyTicket("b", 98));
  await second.collection("tickets").put("d", legacyTicket("d", 98));
  const contexts = pair.devices.map((storage) => makeCommandContext({ storage, params: {} }));
  for (const storage of pair.devices) {
    await storage.migrate(3, async () => {});
    for (const id of ["a", "b", "c", "d", "e"]) seedTicketIdentity(storage, { id, shorthand: `T-${id}` });
  }
  for (const ctx of contexts) await migratePlannerStorage(ctx);
  await pair.merge();
  const ordered = async (storage: typeof first) => {
    const rows = await storage.collection<ReturnType<typeof legacyTicket> & { position?: string }>("tickets").list();
    for (const row of rows) {
      expect(typeof row.position).toBe("string");
      expect(row).not.toHaveProperty("sortOrder");
      expect(row.content).toBe("Keep these instructions");
    }
    return rows.sort((a, b) => (a.position! < b.position! ? -1 : 1));
  };
  const migrated = await ordered(first);
  expect(await ordered(second)).toEqual(migrated);
  expect(new Set(migrated.map(({ position }) => position)).size).toBe(5);
  const ids = migrated.map(({ id }) => id);
  // Two offline moves into the same gap must create separate positions, not a shared numeric midpoint.
  await reorderTicket(contexts[0]!, { rowId: ids[3]!, beforeRowId: ids[1]! });
  await reorderTicket(contexts[1]!, { rowId: ids[4]!, beforeRowId: ids[1]! });
  await pair.merge();
  const moved = await ordered(first);
  expect(await ordered(second)).toEqual(moved);
  expect(moved.map(({ id }) => id).sort()).toEqual(["a", "b", "c", "d", "e"]);
  expect(new Set(moved.map(({ position }) => position)).size).toBe(5);
  // A subsequent migration/read does not reset the converged manual moves.
  for (const ctx of contexts) await migratePlannerStorage(ctx);
  await reorderTicket(contexts[1]!, { rowId: moved.at(-1)!.id, beforeRowId: moved[0]!.id });
  await pair.merge();
  expect(await ordered(first)).toEqual(await ordered(second));
  expect((await ordered(first))[0]!.id).toBe(moved.at(-1)!.id);
});

test("a legacy card arriving after the shared migration remains movable", async () => {
  const pair = await createMemoryStorageDevices();
  for (const storage of pair.devices) {
    await storage.migrate(3, async () => {});
    for (const id of ["a", "c", "late"]) seedTicketIdentity(storage, { id, shorthand: `T-${id}` });
  }
  await pair.devices[0].collection("tickets").put("a", legacyTicket("a", 0));
  await pair.devices[0].collection("tickets").put("c", legacyTicket("c", 2));
  await pair.merge();
  const contexts = pair.devices.map((storage) => makeCommandContext({ storage, params: {} }));
  await migratePlannerStorage(contexts[0]!);
  await reorderTicket(contexts[0]!, { rowId: "a" });
  await pair.devices[1].collection("tickets").put("late", legacyTicket("late", 1));
  await pair.merge();
  for (const ctx of contexts) await readMigratedTickets(ctx);
  await pair.merge();
  const imported = await pair.devices[0].collection<{ position: string }>("tickets").get("late");
  const moved = await pair.devices[0].collection<{ position: string }>("tickets").get("a");
  expect(imported!.position > moved!.position).toBe(true);
  await reorderTicket(contexts[0]!, { rowId: "a" });
  const rows = await pair.devices[0].collection<{ id: string; position?: string }>("tickets").list();
  expect(rows.every(({ position }) => typeof position === "string")).toBe(true);
  expect(rows.find(({ id }) => id === "a")!.position! > rows.find(({ id }) => id === "late")!.position!).toBe(true);
});

test("a content edit read before migration cannot remove the imported position", async () => {
  const { createMemoryStorage } = await import("@pstdio/sdk/testing");
  const { updateTicket } = await import("./collections");
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  seedTicketIdentity(storage, { id: "a", shorthand: "T-a" });
  const before = { ...legacyTicket("a", 0), shorthand: "T-a" };
  await storage.collection("tickets").put("a", before);
  await migratePlannerStorage(ctx);
  await updateTicket(ctx, { ...before, title: "User edit" });
  const saved = await storage.collection<{ position?: string; title: string }>("tickets").get("a");
  expect(saved!.title).toBe("User edit");
  expect(typeof saved!.position).toBe("string");
  expect(saved).not.toHaveProperty("sortOrder");
});

test("an order import keeps a remote edit received after its observed read", async () => {
  const pair = await createMemoryStorageDevices();
  const [first, second] = pair.devices;
  await first.migrate(3, async () => {});
  await first.collection("tickets").put("a", legacyTicket("a", 0));
  await pair.merge();
  let edited = false;
  const storage: typeof first = {
    ...first,
    collection<T>(name: string) {
      const collection = first.collection<T>(name);
      return {
        ...collection,
        async read(id: string) {
          const observed = await collection.read(id);
          if (name === "tickets" && !edited) {
            edited = true;
            const remote = second.collection<ReturnType<typeof legacyTicket>>("tickets");
            await remote.update(id, { ...(await remote.get(id))!, title: "Remote edit" });
            await pair.merge();
          }
          return observed;
        },
      };
    },
  };
  await migratePlannerStorage(makeCommandContext({ storage, params: {} }));
  await pair.merge();
  expect(edited).toBe(true);
  for (const device of pair.devices) {
    const saved = await device.collection<ReturnType<typeof legacyTicket> & { position: string }>("tickets").get("a");
    expect(saved!.title).toBe("Remote edit");
    expect(typeof saved!.position).toBe("string");
    expect(saved).not.toHaveProperty("sortOrder");
  }
});

test("a content edit during an interrupted import keeps negative legacy ranks until cleanup", async () => {
  const { createMemoryStorage } = await import("@pstdio/sdk/testing");
  const { updateTicket } = await import("./collections");
  const storage = createMemoryStorage();
  await storage.migrate(3, async () => {});
  const records = storage.collection<ReturnType<typeof legacyTicket> & { position?: string }>("tickets");
  await records.put("z", legacyTicket("z", -2));
  await records.put("a", legacyTicket("a", -1));
  for (const id of ["z", "a"]) seedTicketIdentity(storage, { id, shorthand: `T-${id}` });
  const ctx = makeCommandContext({ storage, params: {} });
  let interrupted = false;
  const pausing: typeof storage = {
    ...storage,
    collection<T>(name: string) {
      const collection = storage.collection<T>(name);
      return {
        ...collection,
        async read(id: string) {
          if (name === "tickets" && id === "a" && !interrupted) {
            interrupted = true;
            await updateTicket(ctx, { ...(await records.get("z"))!, title: "User edit" });
            throw new Error("Interrupted before the second position");
          }
          return collection.read(id);
        },
      };
    },
  };
  await expect(migratePlannerStorage(makeCommandContext({ storage: pausing, params: {} }))).rejects.toThrow(
    "Interrupted",
  );
  expect((await records.get("z"))!.sortOrder).toBe(-2);
  await migratePlannerStorage(ctx);
  const rows = (await records.list()).sort((a, b) => (a.position! < b.position! ? -1 : 1));
  expect(rows.map(({ id }) => id)).toEqual(["z", "a"]);
  expect(rows[0]!.title).toBe("User edit");
  for (const row of rows) expect(row).not.toHaveProperty("sortOrder");
});

test("a private override leaves arriving legacy order to the synced extension", async () => {
  const { createMemoryStorage } = await import("@pstdio/sdk/testing");
  const storage = createMemoryStorage();
  await storage.migrate(4, async () => {});
  await storage.collection("tickets").put("a", legacyTicket("a", 0));
  const readonly = { ...storage, canMigrate: async () => false };
  seedTicketIdentity(readonly, { id: "a", shorthand: "T-a" });
  const rows = await readMigratedTickets(makeCommandContext({ storage: readonly, params: {} }));
  expect(rows).toHaveLength(1);
  expect(rows[0]).not.toHaveProperty("position");
  expect(await storage.collection("tickets").get("a")).toMatchObject({ sortOrder: 0 });
});
