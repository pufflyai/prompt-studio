import { afterEach, expect, test } from "bun:test";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRelayLogs } from "./logs";
import { numberRelayFixture } from "./resource-number-sync.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

test("an extension's active log follower reads encrypted changes through its registered relay transport", async () => {
  const id = crypto.randomUUID();
  const owner = { workbenchId: id, extensionId: "example.logs" };
  const space = await createSyncSpace({
    projectId: id,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const relays = numberRelayFixture();
  const peer = async () => {
    const { db, close } = await createDb({ path: ":memory:" });
    cleanup.push(close);
    const now = new Date().toISOString();
    await db.insert(projects).values({ id, name: "Logs", shorthand: "L", created_at: now, updated_at: now });
    const service = createExtensionStorageDBService(db);
    const controller = new AbortController();
    const subscriptions: string[] = [];
    const transport = createRelayLogs({
      owner,
      space,
      service: service.logs,
      signal: controller.signal,
      relay: (documentId) => {
        return relays.relay(documentId);
      },
      subscribe: (_owner, documentId) => {
        subscriptions.push(documentId);
      },
    });
    cleanup.push(async () => {
      controller.abort();
      await transport.close();
    });
    return { transport, subscriptions, log: service.logs.open(owner, { name: "comments" }, "project"), controller };
  };
  const first = await peer();
  const second = await peer();
  await first.log.append("first", { id: "first" });
  await first.transport.publish();
  const iterator = second.log.follow({ signal: second.controller.signal })[Symbol.asyncIterator]();
  expect((await iterator.next()).value?.id).toBe("first");
  const next = iterator.next();
  await first.log.append("second", { id: "second" });
  await first.transport.publish();
  expect(second.transport.changed(second.subscriptions[0]!)).toBe(true);
  expect((await next).value?.id).toBe("second");
  expect(second.transport.has("another-owner-document")).toBe(false);
  second.controller.abort();
  expect((await iterator.next()).done).toBe(true);
});
