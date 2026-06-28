import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadataWithTickets } from "./module-test-fixtures";

describe("createExtensionsModule linked resource views", () => {
  test("opens linked ticket resources with project metadata for companion webviews", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const loadAppearance = mock(async () => emptyAppearance);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

    try {
      await flushMicrotasks();

      await workbench.resources.openResource({
        kind: "ticket",
        uri: "pstdio://extension-resource/ticket/PS-11",
        id: "PS-11",
        label: "PS-11 Linked ticket",
      });

      const mainRightResource = workbench.layout.getLayout().areas["main-right"].widgets[0]?.resource;
      expect(mainRightResource).toMatchObject({
        id: "PS-11",
        metadata: { projectId: "project-1" },
      });
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("preserves linked ticket resource project metadata for companion webviews", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const loadAppearance = mock(async () => emptyAppearance);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "active-project", name: "Active project" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

    try {
      await flushMicrotasks();

      await workbench.resources.openResource({
        kind: "ticket",
        uri: "pstdio://extension-resource/ticket/PS-12",
        id: "PS-12",
        label: "PS-12 Linked ticket",
        metadata: { projectId: "linked-project" },
      });

      const mainRightResource = workbench.layout.getLayout().areas["main-right"].widgets[0]?.resource;
      expect(mainRightResource).toMatchObject({
        id: "PS-12",
        metadata: { projectId: "linked-project" },
      });
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("active-project");
    }
  });
});
