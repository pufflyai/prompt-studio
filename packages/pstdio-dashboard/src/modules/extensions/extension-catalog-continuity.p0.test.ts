import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import {
  emptyDashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks } from "./module-test-fixtures";

test("extension registration reuses warm catalogs and catches up only the inactive project that changed", async () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => {} });
  const counts = { metadata: { a: 0, b: 0 }, appearance: { a: 0, b: 0 } };
  const select = (id: "a" | "b") => selectDashboardProject(workbench, { id: `catalog-${id}`, name: id });
  select("a");
  const registration = workbench.registerModule(
    createExtensionsModule({
      loadMetadata: async (id) => {
        counts.metadata[id.endsWith("a") ? "a" : "b"]++;
        return emptyDashboardExtensionMetadata;
      },
      loadAppearance: async (id) => {
        counts.appearance[id.endsWith("a") ? "a" : "b"]++;
        return emptyAppearance;
      },
    }),
  );
  const writer = getRuntimeCollections().getWriter("extension_instances")!;
  try {
    await flushMicrotasks();
    select("b");
    await flushMicrotasks();
    select("a");
    expect(getCachedDashboardExtensionMetadata("catalog-a")).toBeDefined();
    await flushMicrotasks();
    expect(counts).toEqual({ metadata: { a: 1, b: 1 }, appearance: { a: 1, b: 1 } });
    writer.upsert({ id: "catalog-b-extension", scope_type: "project", scope_id: "catalog-b", enabled: true });
    await flushMicrotasks();
    expect(counts).toEqual({ metadata: { a: 1, b: 1 }, appearance: { a: 1, b: 1 } });
    select("b");
    await flushMicrotasks();
    expect(counts).toEqual({ metadata: { a: 1, b: 2 }, appearance: { a: 1, b: 2 } });
  } finally {
    registration.dispose();
    writer.remove("catalog-b-extension");
    await workbench.dispose();
  }
});
