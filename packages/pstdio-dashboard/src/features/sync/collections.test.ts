import { describe, expect, test } from "bun:test";
import { getWriter, SYNCED_TABLES, subscribeCollections } from "./collections";

describe("SYNCED_TABLES", () => {
  test("includes extension rows used by dashboard contribution selectors", () => {
    expect(SYNCED_TABLES).toContain("installed_extension_sources");
    expect(SYNCED_TABLES).toContain("extension_instances");
  });

  test("notifies subscribers when synced rows change", () => {
    const changes: string[] = [];
    const unsubscribe = subscribeCollections((change) => {
      changes.push(change.table);
    });

    getWriter("projects")?.truncateAndWrite([{ id: "project-1", name: "Project" }]);

    unsubscribe();
    expect(changes).toEqual(["projects"]);
  });
});
