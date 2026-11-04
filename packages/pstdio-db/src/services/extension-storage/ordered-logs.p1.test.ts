import { afterEach, expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createLogStreamSync } from "pstdio-sync/logs";
import * as Y from "yjs";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createOrderedLogs } from "./ordered-logs";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
const fixture = async () => {
  const id = crypto.randomUUID();
  const owner = { workbenchId: id, extensionId: "example.logs" };
  const space = await createSyncSpace({
    projectId: id,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const relays = new Map<string, ReturnType<typeof createRelay>>();
  const device = async () => {
    const { db, close } = await createDb({ path: ":memory:" });
    cleanup.push(close);
    const now = new Date().toISOString();
    await db.insert(projects).values({ id, name: "Logs", shorthand: "L", created_at: now, updated_at: now });
    const documents = createDocumentStorageDBService(db);
    const logs = createOrderedLogs(db, { metadata: documents.transaction, changed: () => {} });
    return {
      logs,
      documents,
      connect() {
        logs.attach(owner, async (entry, store) => {
          const name = JSON.stringify([entry.name, entry.scope, entry.stream]);
          const relay = relays.get(name) ?? createRelay();
          relays.set(name, relay);
          return createLogStreamSync({ space, documentId: await space.documentId(name), relay: relay.relay, store });
        });
      },
    };
  };
  return { owner, first: await device(), second: await device() };
};

test("independent device logs discover both writers and page all entries without skipping a writer", async () => {
  const { owner, first, second } = await fixture();
  const definition = { name: "runs", writer: "device" as const };
  const left = first.logs.open(owner, definition, "project");
  const right = second.logs.open(owner, definition, "project");
  await left.append("left one", { id: "left-one" });
  await right.append("right one", { id: "right-one" });
  await left.append("left two", { id: "left-two" });
  const a = await first.documents.transaction(owner, async ({ document }) => Y.encodeStateAsUpdate(document));
  const b = await second.documents.transaction(owner, async ({ document }) => Y.encodeStateAsUpdate(document));
  await first.documents.transaction(owner, async ({ document }) => Y.applyUpdate(document, b));
  await second.documents.transaction(owner, async ({ document }) => Y.applyUpdate(document, a));
  first.connect();
  second.connect();
  await first.logs.publish(owner);
  await second.logs.publish(owner);
  const seen = [];
  let after: string | 0 = 0;
  for (let page = 0; page < 4; page++) {
    const result = await right.read({ after, limit: 1 });
    seen.push(...result.entries.map((entry) => entry.id));
    after = result.cursor;
    if (!result.more) break;
  }
  expect(new Set(seen)).toEqual(new Set(["left-one", "right-one", "left-two"]));
  expect(seen).toHaveLength(3);
});

test("following an offline logical log yields durable appends and releases on cancellation", async () => {
  const { owner, first } = await fixture();
  const log = first.logs.open(owner, { name: "comments" }, "project");
  const controller = new AbortController();
  const iterator = log.follow({ signal: controller.signal })[Symbol.asyncIterator]();
  const next = iterator.next();
  await log.append({ comment: "arrived" }, { id: "comment" });
  expect((await next).value?.id).toBe("comment");
  controller.abort();
  expect((await iterator.next()).done).toBe(true);
});
