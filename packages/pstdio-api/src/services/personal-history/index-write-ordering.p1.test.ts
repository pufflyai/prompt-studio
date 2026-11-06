import { expect, test } from "bun:test";
import { createDb, createExtensionStorageDBService, projects, storage_personal_history } from "pstdio-db";
import { createSyncSpace } from "pstdio-sync/encryption";
import { logRelayFixture } from "./log-transport.fixture";
import { createPersonalHistoryStore } from "./store";

for (const interleaving of ["acknowledged", "newer-pending"] as const) {
  test(`a delayed index projection cannot replace ${interleaving} state`, async () => {
    const connection = await createDb({ path: ":memory:" });
    const release = Promise.withResolvers<void>();
    let first: Promise<unknown> | undefined;
    try {
      const projectId = crypto.randomUUID();
      const now = new Date().toISOString();
      await connection.db
        .insert(projects)
        .values({ id: projectId, name: "Index ordering", shorthand: "I", created_at: now, updated_at: now });
      const storage = createExtensionStorageDBService(connection.db);
      const history = createPersonalHistoryStore({
        projectId,
        accountId: "alice",
        managerOrigin: "https://manager.example",
        documents: storage.documents,
        index: storage.personalHistoryIndex,
        logs: storage.logs,
      });
      const writerId = await storage.logs.writerId();
      const device = { id: writerId, ownerId: "alice", name: "Laptop" };
      const space = await createSyncSpace({
        projectId,
        spaceOwner: "alice",
        keys: [{ generation: 1, secret: "A".repeat(43) }],
      });
      const peer = logRelayFixture();
      await history.readRecords("sessions");
      const captured = Promise.withResolvers<void>();
      const apply = storage.personalHistoryIndex.applyPending;
      let delayed = false;
      storage.personalHistoryIndex.applyPending = async (...args) => {
        if (!delayed) {
          delayed = true;
          captured.resolve();
          await release.promise;
        }
        return apply(...args);
      };
      first = history.patchRecords("sessions", device, [{ id: "one", title: "First" }]);
      await captured.promise;
      if (interleaving === "acknowledged") await history.synchronizeIndex(writerId, true, space, peer.relay);
      else await history.patchRecords("sessions", device, [{ id: "one", title: "Newer" }]);
      release.resolve();
      await first;
      expect((await history.readRecords("sessions"))[0]?.title).toBe(
        interleaving === "acknowledged" ? "First" : "Newer",
      );
      if (interleaving === "acknowledged") {
        expect((await connection.db.select().from(storage_personal_history))[0]!.pending_id).toBeNull();
        const stream = await storage.logs.stream(history.owner, {
          name: "index",
          writer: "device",
          scope: "project",
          stream: writerId,
        });
        await stream.append({
          deviceId: writerId,
          kind: "sessions",
          id: "one",
          value: { id: "one", title: "Later accepted", device },
        });
        await history.synchronizeIndex(writerId, true, space, peer.relay);
        expect((await history.readRecords("sessions"))[0]?.title).toBe("Later accepted");
      }
    } finally {
      release.resolve();
      await first?.catch(() => {});
      await connection.close();
    }
  });
}
