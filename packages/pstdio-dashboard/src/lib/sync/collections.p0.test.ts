import { describe, expect, test } from "bun:test";
import {
  type CollectionChange,
  createRuntimeCollections,
  getCollection,
  getIndexedRows,
  getWriter,
  releaseRuntimeCollections,
  retainRuntimeCollections,
  SYNCED_TABLES,
  subscribeCollections,
} from "./collections";

test("an effect remount retains its collection store until the last connection closes", async () => {
  const connection = { baseUrl: "http://effect-remount", token: "owner" };
  const initial = retainRuntimeCollections(connection);
  initial.getWriter("projects")!.upsert({ id: "project" });
  const closing = releaseRuntimeCollections(connection);
  const remounted = retainRuntimeCollections(connection);
  await closing;
  expect(remounted).toBe(initial);
  expect(remounted.getCollection("projects").get("project")).toEqual({ id: "project" });
  await releaseRuntimeCollections(connection);
  expect(initial.getWriter("projects")).toBeUndefined();
});

test("runtime collections isolate overlapping IDs, indexes, readiness, and subscriptions", async () => {
  const first = createRuntimeCollections();
  const second = createRuntimeCollections();
  const received: string[] = [];
  const unsubscribe = first.subscribeCollections((change) => {
    if (change) received.push(change.table);
  });
  first.getWriter("sessions")!.upsert({ id: "same", project_id: "workbench", title: "First environment" });
  second.getWriter("sessions")!.upsert({ id: "same", project_id: "workbench", title: "Second environment" });
  first.markInitialCollectionsSyncComplete();
  expect(first.getIndexedRows("sessions", "project_id", "workbench")[0]?.title).toBe("First environment");
  expect(second.getIndexedRows("sessions", "project_id", "workbench")[0]?.title).toBe("Second environment");
  expect(second.isInitialCollectionsSyncComplete()).toBe(false);
  expect(received).toEqual(["sessions"]);
  const lateWriter = first.getWriter("sessions")!;
  unsubscribe();
  await first.dispose();
  lateWriter.upsert({ id: "late", project_id: "workbench" });
  expect(second.getIndexedRows("sessions", "project_id", "workbench")).toHaveLength(1);
  expect(received).toEqual(["sessions"]);
  await second.dispose();
});

test("row changes retain previous ownership and indexes follow reassignment and removal", () => {
  const writer = getWriter("workspace_sessions")!;
  writer.truncateAndWrite([{ id: "link", session_id: "old" }]);
  expect(getIndexedRows("workspace_sessions", "session_id", "old")).toHaveLength(1);
  const changes: CollectionChange[] = [];
  const unsubscribe = subscribeCollections((change) => {
    if (change) changes.push(change);
  });
  writer.upsert({ id: "link", session_id: "new" });
  expect(getIndexedRows("workspace_sessions", "session_id", "old")).toEqual([]);
  expect(getIndexedRows("workspace_sessions", "session_id", "new")).toEqual([{ id: "link", session_id: "new" }]);
  writer.remove("link");
  unsubscribe();
  expect(changes.map((change) => change.changes)).toEqual([
    [{ key: "link", previousValue: { id: "link", session_id: "old" }, value: { id: "link", session_id: "new" } }],
    [{ key: "link", previousValue: { id: "link", session_id: "new" } }],
  ]);
  expect(getIndexedRows("workspace_sessions", "session_id", "new")).toEqual([]);
});

test("sync notifications distinguish complete snapshots from row events", () => {
  const changes: CollectionChange[] = [];
  const unsubscribe = subscribeCollections((change) => {
    if (change?.table === "projects") changes.push(change);
  });
  try {
    const writer = getWriter("projects")!;
    writer.truncateAndWrite([{ id: "snapshot-project", name: "Snapshot project" }]);
    writer.upsert({ id: "snapshot-project", name: "Renamed" });
    writer.remove("snapshot-project");
    expect(changes.map((change) => change.type)).toEqual(["snapshot", "row", "row"]);
  } finally {
    unsubscribe();
  }
});

describe("SYNCED_TABLES", () => {
  test("includes extension rows used by dashboard contribution selectors", () => {
    expect(SYNCED_TABLES).toContain("installed_extension_sources");
    expect(SYNCED_TABLES).toContain("extension_instances");
  });

  test("notifies subscribers when synced rows change", () => {
    const changes: string[] = [];
    const unsubscribe = subscribeCollections((change) => {
      if (change) changes.push(change.table);
    });

    getWriter("projects")?.truncateAndWrite([{ id: "project-1", name: "Project" }]);

    unsubscribe();
    expect(changes).toEqual(["projects"]);
  });

  test("keeps synced rows available after collection subscribers unmount", async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    getWriter("projects")?.truncateAndWrite([{ id: "project-persistent", name: "Project" }]);

    globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
      originalSetTimeout(handler, timeout === undefined ? timeout : 0, ...args)) as typeof setTimeout;
    globalThis.clearTimeout = ((timeoutId: ReturnType<typeof setTimeout>) =>
      originalClearTimeout(timeoutId)) as typeof clearTimeout;

    try {
      const subscription = getCollection("projects").subscribeChanges(() => undefined, {
        includeInitialState: true,
      });
      subscription.unsubscribe();

      await new Promise((resolve) => originalSetTimeout(resolve, 10));

      expect(Array.from(getCollection("projects").state.values())).toMatchObject([
        { id: "project-persistent", name: "Project" },
      ]);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
      getWriter("projects")?.truncateAndWrite([]);
    }
  });
});
