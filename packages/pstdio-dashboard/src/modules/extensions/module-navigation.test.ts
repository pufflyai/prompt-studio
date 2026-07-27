import { expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  getDashboardActiveCollection,
  getDashboardSelectedResource,
  selectDashboardNavigationResource,
} from "@/shared/app/navigation-state";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadata } from "./module-test-fixtures";

test("restores extension route navigation after leaving a global collection", async () => {
  const workbench = createWorkbenchCore();

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata: mock(async () => metadata) }));

  try {
    await flushMicrotasks();
    selectDashboardNavigationResource(workbench, {
      kind: "dashboard-view",
      uri: "dashboard-workbench://projects/project-1/sessions",
      id: "sessions",
      label: "Sessions",
    });

    const labResource = workbench.resources.listResources("").find((entry) => entry.resource.id === "lab")?.resource;
    const persistedLabResource = {
      ...labResource!,
      metadata: { projectId: "project-1", routePath: "lab" },
    };
    await workbench.resources.openResource(persistedLabResource);

    expect(getDashboardActiveCollection(workbench)).toBeUndefined();
    expect(getDashboardSelectedResource(workbench)?.uri).toBe(labResource?.uri);
    expect(getDashboardSelectedResource(workbench)?.metadata?.route).toEqual(metadata.routes[0]);
  } finally {
    disposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});
