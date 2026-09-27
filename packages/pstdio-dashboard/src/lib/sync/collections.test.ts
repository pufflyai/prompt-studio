import { describe, expect, test } from "bun:test";
import {
  type CollectionChange,
  getCollection,
  getIndexedRows,
  getWriter,
  SYNCED_TABLES,
  subscribeCollections,
} from "./collections";

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

describe("SYNCED_TABLES", () => {
  test("includes extension rows used by dashboard contribution selectors", () => {
    expect(SYNCED_TABLES).toContain("installed_extension_sources");
    expect(SYNCED_TABLES).toContain("extension_instances");
  });

  test("does not create collections for deprecated core ticket tables", () => {
    const deprecatedTable = ["tic", "kets"].join("");
    expect(SYNCED_TABLES).not.toContain(deprecatedTable as never);
    expect(getWriter(deprecatedTable)).toBeUndefined();
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
