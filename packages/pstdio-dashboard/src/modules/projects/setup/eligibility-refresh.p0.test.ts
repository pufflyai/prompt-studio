import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "@pstdio/workbench";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "../../extensions/module";
import { emptyAppearance, flushMicrotasks, metadata } from "../../extensions/module-test-fixtures";
import { createProjectOpeningModule } from "./module";

test("same-project removal waits for the latest metadata without opening stale setup", async () => {
  const projectId = "setup-removal-refresh";
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.modes.setActiveMode("project");
  selectDashboardProject(workbench, { id: projectId, name: "Setup refresh" });
  const available = {
    ...metadata,
    projectSetups: [
      {
        extensionId: metadata.extensions[0].id,
        view: {
          extensionId: metadata.extensions[0].id,
          kind: "view" as const,
          id: "labPage",
        },
      },
    ],
  } satisfies WorkbenchExtensionMetadata;
  let initial = true;
  const refreshes: ReturnType<typeof Promise.withResolvers<WorkbenchExtensionMetadata>>[] = [];
  const extensions = workbench.registerModule(
    createExtensionsModule({
      loadAppearance: async () => emptyAppearance,
      loadMetadata: () => {
        if (initial) {
          initial = false;
          return Promise.resolve(available);
        }
        const request = Promise.withResolvers<WorkbenchExtensionMetadata>();
        refreshes.push(request);
        return request.promise;
      },
    }),
  );
  const opening = createProjectOpeningModule();
  const setup = workbench.registerModule(opening.module);
  const owner = getRuntimeCollections();
  owner.getCollection("extension_instances");
  const writer = owner.getWriter("extension_instances")!;
  try {
    await flushMicrotasks();
    await flushMicrotasks();
    writer.upsert({ id: projectId });
    await flushMicrotasks();
    // Installed contributions remain live during refresh; they are not fresh setup eligibility.
    expect(workbench.views.getView(metadata.views[0].id)).toBeDefined();
    const pending = opening.open(Promise.resolve({ id: projectId, created: true }));
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    writer.upsert({ id: projectId, enabled: false });
    await flushMicrotasks();
    refreshes[0]!.resolve(available);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    refreshes[1]!.resolve(emptyDashboardExtensionMetadata);
    await pending;
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    expect(workbench.views.getView(metadata.views[0].id)).toBeUndefined();
  } finally {
    for (const request of refreshes) request.resolve(emptyDashboardExtensionMetadata);
    setup.dispose();
    extensions.dispose();
    writer.remove(projectId);
  }
});
