import { expect, test } from "bun:test";
import { createDb, createExtensionStorageDBService, createProjectsDBService } from "pstdio-db";
import { createResourceActivityStore } from "./resource-activity-store";

const resource = { projectId: "", extensionId: "test.owner", type: "note", id: "same-id" };
const author = { type: "user" as const, id: "person", name: "Person" };

test("resource discussions persist independently, paginate and resolve without rewriting outcomes", async () => {
  const db = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(db.db).create({ name: "Activity" });
    const storage = createExtensionStorageDBService(db.db);
    const store = createResourceActivityStore(storage, project.id);
    const ref = { ...resource, projectId: project.id };
    const other = { ...ref, extensionId: "another.owner" };
    const comment = await store.append(
      ref,
      { key: "comment-1", kind: "comment", body: "Review this", quote: "Original text" },
      author,
    );
    expect(
      await store.append(
        ref,
        { key: "comment-1", kind: "comment", body: "Review this", quote: "Original text" },
        author,
      ),
    ).toEqual(comment);
    await expect(store.append(ref, { key: "comment-1", kind: "comment", body: "Changed" }, author)).rejects.toThrow(
      "key",
    );
    await store.append(other, { key: "comment-1", kind: "comment", body: "Separate" }, author);
    await expect(store.get(other, comment.id)).rejects.toThrow("resource");
    await store.append(ref, { key: "reply-1", kind: "comment", body: "I agree", replyToId: comment.id }, author);
    const first = await store.query(ref, { limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeString();
    expect((await store.query(ref, { cursor: first.nextCursor!, limit: 1 })).items).toHaveLength(1);
    await store.append(other, { key: "another-resource-write", kind: "comment", body: "Remote update" }, author);
    expect((await store.query(ref, { cursor: first.nextCursor!, limit: 1 })).items).toHaveLength(1);
    await expect(store.query(other, { cursor: first.nextCursor!, limit: 1 })).rejects.toThrow("another resource");
    expect(await store.unresolved(ref)).toBe(1);
    await store.resolve(ref, comment.id, true);
    expect(await store.unresolved(ref)).toBe(0);
    await store.resolve(ref, comment.id, false);
    expect(await store.unresolved(ref)).toBe(1);
    const outcome = await store.append(
      ref,
      {
        key: "implementation-1",
        kind: "implementation",
        body: "Implemented",
        revision: { workspaceId: "ws-1", sessionId: "session-1", headSha: "a".repeat(40), revision: 1 },
        validation: [{ command: "bun test", result: "passed" }],
      },
      author,
    );
    await expect(store.resolve(ref, outcome.id, true)).rejects.toThrow("discussion");
    const reopened = createResourceActivityStore(storage, project.id);
    expect((await reopened.get(ref, outcome.id)).revision?.headSha).toBe("a".repeat(40));
    expect((await reopened.query(other, {})).items.map((entry) => entry.body)).toEqual(["Remote update", "Separate"]);
  } finally {
    await db.close();
  }
});

test("offline peers cannot rewrite a referenced implementation by reusing its retry key", async () => {
  const { createSyncSpace } = await import("pstdio-sync/encryption");
  const { createRecordStreamSync } = await import("pstdio-sync/relay");
  const { numberRelayFixture } = await import("../../services/relay/resource-number-sync.fixture");
  const databases = await Promise.all([createDb({ path: ":memory:" }), createDb({ path: ":memory:" })]);
  try {
    const projectId = crypto.randomUUID();
    const stores: ReturnType<typeof createResourceActivityStore>[] = [];
    const services: ReturnType<typeof createExtensionStorageDBService>[] = [];
    for (const database of databases) {
      await createProjectsDBService(database.db).create({ id: projectId, name: "Peer" });
      const storage = createExtensionStorageDBService(database.db);
      services.push(storage);
      stores.push(createResourceActivityStore(storage, projectId));
    }
    const ref = { ...resource, projectId };
    const revision = { workspaceId: "workspace", sessionId: "implementer", headSha: "a".repeat(40), revision: 1 };
    const first = await stores[0]!.append(
      ref,
      { key: "same-key", kind: "implementation", body: "Original evidence", revision },
      author,
    );
    const second = await stores[1]!.append(
      ref,
      {
        key: "same-key",
        kind: "implementation",
        body: "Different evidence",
        revision: { ...revision, headSha: "b".repeat(40) },
      },
      author,
    );
    expect(first.id).not.toBe(second.id);
    const space = await createSyncSpace({
      projectId,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const documentId = await space.documentId(JSON.stringify([stores[0]!.owner.extensionId, "record-stream-v2"]));
    const relay = numberRelayFixture().relay(documentId);
    const syncs = services.map((storage) =>
      createRecordStreamSync({
        space,
        documentId,
        relay,
        store: storage.documents.recordStream(stores[0]!.owner),
        quarantine: async (failure) => {
          throw new Error(JSON.stringify(failure));
        },
      }),
    );
    await syncs[0]!.synchronize();
    await syncs[1]!.synchronize();
    await syncs[0]!.synchronize();
    for (const store of stores) {
      expect((await store.get(ref, first.id)).body).toBe("Original evidence");
      expect((await store.get(ref, first.id)).revision?.headSha).toBe(revision.headSha);
      expect((await store.get(ref, second.id)).body).toBe("Different evidence");
    }
  } finally {
    await Promise.all(databases.map((database) => database.close()));
  }
});
