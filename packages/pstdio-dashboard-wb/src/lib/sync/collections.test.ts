import { describe, expect, test } from "bun:test";
import { getWriter, SYNCED_TABLES, subscribeCollections } from "./collections";

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
});
