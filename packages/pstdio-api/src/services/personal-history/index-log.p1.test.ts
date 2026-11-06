import { expect, test } from "bun:test";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import { transferPersonalIndex } from "./index-transfer.fixture";
import { createPersonalHistoryStore, legacyPersonalHistoryOwner } from "./store";

test("personal index rows are durable device-log deltas rather than CRDT index content", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const now = new Date().toISOString();
    await db
      .insert(projects)
      .values({ id: "private-project", name: "History", shorthand: "H", created_at: now, updated_at: now });
    const storage = createExtensionStorageDBService(db);
    const input = {
      projectId: "private-project",
      accountId: "alice",
      managerOrigin: "https://manager.example",
      documents: storage.documents,
      index: storage.personalHistoryIndex,
      logs: storage.logs,
    };
    const history = createPersonalHistoryStore(input);
    const device = { ownerId: "alice", id: await storage.logs.writerId(), name: "Laptop" };
    await history.writeRecords("sessions", device, [{ id: "one", title: "Private title" }]);
    expect(await createPersonalHistoryStore(input).readRecords("sessions")).toEqual([
      { id: "one", title: "Private title", device },
    ]);
    expect(
      await history.records.transaction(history.owner, async ({ document }) => document.getMap("sessions").size),
    ).toBe(0);
    expect(await storage.logs.pending(history.owner)).toBe(true);
    const stream = await storage.logs.stream(history.owner, {
      name: "index",
      scope: "project",
      stream: device.id,
      writer: "device",
    });
    const before = (await stream.pending(100)).length;
    await history.writeRecords("sessions", device, [{ id: "one", title: "Private title" }]);
    expect((await stream.pending(100)).length).toBe(before);
  } finally {
    await close();
  }
});

test("private index delta pages preserve remote rows, queue deletion and saved cursors after restart", async () => {
  const connections: Awaited<ReturnType<typeof createDb>>[] = [];
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const peer = async () => {
      const connection = await createDb({ path: ":memory:" });
      connections.push(connection);
      await connection.db
        .insert(projects)
        .values({ id, name: "Private", shorthand: "P", created_at: now, updated_at: now });
      const storage = createExtensionStorageDBService(connection.db);
      const input = {
        projectId: id,
        accountId: "alice",
        managerOrigin: "https://manager.example",
        documents: storage.documents,
        index: storage.personalHistoryIndex,
        logs: storage.logs,
      };
      const history = createPersonalHistoryStore(input);
      return { storage, history, input };
    };
    const source = await peer();
    const destination = await peer();
    const device = { ownerId: "alice", id: await source.storage.logs.writerId(), name: "Laptop" };
    await source.history.writeRecords("sessions", device, [{ id: "one", title: "Private one" }]);
    await source.history.writeRecords("queues", device, [{ id: "one", requests: [{ id: "queued" }] }]);
    const synchronize = () =>
      transferPersonalIndex(source.storage, destination.storage, {
        projectId: id,
        accountId: "alice",
        managerOrigin: "https://manager.example",
      });
    await synchronize();
    expect((await destination.history.readRecords("sessions"))[0]?.title).toBe("Private one");
    expect((await destination.history.readRecords("queues"))[0]?.id).toBe("one");
    await source.history.writeRecords("sessions", device, [{ id: "two", title: "Private two" }]);
    await source.history.writeRecords("queues", device, []);
    await synchronize();
    const restarted = createPersonalHistoryStore(destination.input);
    expect((await restarted.readRecords("sessions")).map((row) => row.id)).toEqual(["two"]);
    expect(await restarted.readRecords("queues")).toEqual([]);
    const cursor = await destination.storage.personalHistoryIndex.cursor(restarted.owner);
    await synchronize();
    expect(await destination.storage.personalHistoryIndex.cursor(restarted.owner)).toBe(cursor);
    const other = createPersonalHistoryStore({ ...destination.input, accountId: "bob" });
    expect(await other.readRecords("sessions")).toEqual([]);
  } finally {
    await Promise.all(connections.map((connection) => connection.close()));
  }
});

test("upgrade retains the original index until its device-log conversion is durable", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const now = new Date().toISOString();
    await connection.db
      .insert(projects)
      .values({ id: "upgrade-project", name: "Upgrade", shorthand: "U", created_at: now, updated_at: now });
    const storage = createExtensionStorageDBService(connection.db);
    const input = {
      projectId: "upgrade-project",
      accountId: "alice",
      managerOrigin: "https://manager.example",
      documents: storage.documents,
      index: storage.personalHistoryIndex,
      logs: storage.logs,
    };
    const device = { ownerId: "alice", id: await storage.logs.writerId(), name: "Laptop" };
    const legacy = storage.documents.open("records");
    await legacy.transaction(legacyPersonalHistoryOwner(input), async ({ document }) => {
      document.getMap("sessions").set("saved", JSON.stringify({ id: "saved", title: "Saved private history", device }));
      document.getMap("heads").set("saved", 4);
    });
    const history = createPersonalHistoryStore(input);
    expect((await history.readRecords("sessions"))[0]?.id).toBe("saved");
    expect((await history.readHeads()).get("saved")).toBe(4);
    expect(await storage.logs.pending(history.owner)).toBe(true);
    expect(
      await legacy.transaction(
        legacyPersonalHistoryOwner(input),
        async ({ document }) => document.getMap("sessions").size,
      ),
    ).toBe(1);
  } finally {
    await connection.close();
  }
});

test("a new device recovers a cached legacy writer's history and later honors its deletion over late seeds", async () => {
  const connections: Awaited<ReturnType<typeof createDb>>[] = [];
  try {
    const identity = { projectId: crypto.randomUUID(), accountId: "alice", managerOrigin: "https://manager.example" };
    const peer = async () => {
      const connection = await createDb({ path: ":memory:" });
      connections.push(connection);
      const now = new Date().toISOString();
      await connection.db
        .insert(projects)
        .values({ id: identity.projectId, name: "Seed recovery", shorthand: "S", created_at: now, updated_at: now });
      const storage = createExtensionStorageDBService(connection.db);
      const history = createPersonalHistoryStore({
        ...identity,
        documents: storage.documents,
        logs: storage.logs,
        index: storage.personalHistoryIndex,
      });
      return { storage, history };
    };
    const origin = await peer();
    const cached = await peer();
    const reader = await peer();
    const late = await peer();
    const device = { ownerId: identity.accountId, id: await origin.storage.logs.writerId(), name: "Offline origin" };
    const row = { id: "saved", title: "Cached private history", device };
    const seed = async (current: typeof cached) => {
      await current.storage.documents
        .open("records")
        .transaction(legacyPersonalHistoryOwner(identity), async ({ document }) =>
          document.getMap("sessions").set(row.id, JSON.stringify(row)),
        );
      await current.history.readRecords("sessions");
      await transferPersonalIndex(current.storage, reader.storage, identity);
    };
    await seed(cached);
    expect(await reader.history.readRecords("sessions")).toEqual([row]);
    await origin.history.writeRecords("sessions", device, [row]);
    await origin.history.writeRecords("sessions", device, []);
    await transferPersonalIndex(origin.storage, reader.storage, identity);
    expect(await reader.history.readRecords("sessions")).toEqual([]);
    await seed(late);
    expect(await reader.history.readRecords("sessions")).toEqual([]);
  } finally {
    await Promise.all(connections.map((connection) => connection.close()));
  }
});
