import { describe, expect, test } from "bun:test";
import { getCollection, getWriter, SYNCED_TABLES, subscribeCollections } from "./collections";

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

      expect(Array.from(getCollection("projects").state.values())).toEqual([
        { id: "project-persistent", name: "Project" },
      ]);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
      getWriter("projects")?.truncateAndWrite([]);
    }
  });
});
