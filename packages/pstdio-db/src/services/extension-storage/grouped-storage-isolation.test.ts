import { afterEach, expect, test } from "bun:test";
import { extension_storage_journal, sessions, settings, workspaces } from "../../db/schemas.pg";
import { groupedStorageOwner, openGroupedTestStorage } from "./grouped-storage-test-fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("isolated stores with overlapping IDs journal only explicitly authored extension records", async () => {
  const first = await openGroupedTestStorage(cleanup);
  const second = await openGroupedTestStorage(cleanup);
  const timestamp = new Date().toISOString();
  await first.db.insert(sessions).values({
    id: "local-conversation",
    project_id: groupedStorageOwner.workbenchId,
    title: "Private conversation",
    cwd: "/private/local/code",
    agent_session_id: "private-harness-process",
    created_at: timestamp,
    updated_at: timestamp,
  });
  await first.db.insert(workspaces).values({
    id: "local-folder",
    project_id: groupedStorageOwner.workbenchId,
    name: "Private checkout",
    root_path: "/private/local/code",
    workspace_shorthand: "WS-1",
    provider_params_json: { processId: 12345 },
    created_at: timestamp,
    updated_at: timestamp,
  });
  await first.db.insert(settings).values({ max_concurrent_sessions: 3, created_at: timestamp, updated_at: timestamp });
  for (const [storage, value] of [
    [first, "First content"],
    [second, "Second content"],
  ] as const) {
    await storage.records.commit({
      operationId: "same-operation",
      edits: [{ recordId: "note", expectedRevision: (await storage.records.read("note")).revision, replace: value }],
    });
    expect((await storage.records.list()).map(({ recordId, value }) => ({ recordId, value }))).toEqual([
      { recordId: "note", value },
    ]);
    const journal = await storage.db.select().from(extension_storage_journal);
    expect(journal).toHaveLength(1);
    expect(journal[0]!.mutation_json.changes.map(({ recordId }) => recordId)).toEqual(["note"]);
  }
  expect((await first.records.read("note")).value).toBe("First content");
  expect((await second.records.read("note")).value).toBe("Second content");
  expect((await first.db.select().from(sessions))[0]!.agent_session_id).toBe("private-harness-process");
  expect((await first.db.select().from(workspaces))[0]!.provider_params_json).toEqual({ processId: 12345 });
});
