import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import {
  clearCachedDashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { createWorkspacesModule } from "./module";

test("workspace search follows the configured ordinary opener while core retains its records", () => {
  getCollection("workspaces");
  const row = { id: "retained", project_id: "presentation-choice", name: "Retained workspace", is_default: true };
  getWriter("workspaces")!.upsert(row);
  const w = createWorkbench();
  w.registerModule(createWorkspacesModule());
  selectDashboardProject(w, { id: row.project_id, name: "Project" });
  const page = { kind: "page" as const, extensionId: "example.reader", id: "desk" };
  setCachedDashboardExtensionMetadata(row.project_id, {
    ...emptyDashboardExtensionMetadata,
    composition: {
      resourceOpeners: [
        { resourceKind: { kind: "resource-kind", extensionId: "pstdio", id: "workspace" }, opener: page },
      ],
    },
  });
  try {
    expect(w.resources.listResources("")).toEqual([]);
    const installed = w.pages.registerPage({
      id: "example.reader.page.desk",
      ref: page,
      path: "custom-destination",
      modeId: "project",
      resource: { kinds: [{ kind: "resource-kind", extensionId: "pstdio", id: "workspace" }] },
      main: { kind: "panels" },
      slots: [],
    });
    expect(w.resources.listResources("")).toContainEqual(
      expect.objectContaining({ resource: expect.objectContaining({ id: row.id }) }),
    );
    installed.dispose();
    expect(w.resources.listResources("")).toEqual([]);
    expect(
      w.resources.getKind("workspace", "pstdio")!.resolve!({ type: "workspace", extensionId: "pstdio", id: row.id })
        ?.label,
    ).toBe(row.name);
  } finally {
    clearCachedDashboardExtensionMetadata(row.project_id);
    getWriter("workspaces")!.remove(row.id);
    w.dispose();
  }
});
