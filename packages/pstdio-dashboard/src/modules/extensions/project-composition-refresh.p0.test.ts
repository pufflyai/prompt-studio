import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { createDashboardSyncWriterProvider } from "@/lib/sync/sync-client";
import { selectDashboardProject } from "@/shared/app/project-context";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { configuredResourceOpener } from "@/shared/workbench/resource-openers";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadata } from "./module-test-fixtures";

test("composition updates refresh choices in an open project without replacing its explicit page", async () => {
  const projectId = "live-composition";
  const first = { kind: "page" as const, extensionId: metadata.pages[0].extensionId, id: metadata.pages[0].localId };
  const second = { ...first, id: "desk" };
  const resourceKind = { kind: "resource-kind" as const, extensionId: "pstdio", id: "workspace" };
  let current: WorkbenchExtensionMetadata = {
    ...metadata,
    pages: [
      ...metadata.pages,
      { ...metadata.pages[0], id: `${second.extensionId}.page.desk`, localId: "desk", path: "desk" },
    ],
    composition: { defaultPage: first, resourceOpeners: [{ resourceKind, opener: first }] },
  };
  const w = createWorkbench({
    defaultPage: () => getCachedDashboardExtensionMetadata(projectId)?.composition?.defaultPage ?? undefined,
  });
  w.modes.registerMode({ id: "project", activate() {} });
  selectDashboardProject(w, { id: projectId, name: "Live composition" });
  const extension = w.registerModule(
    createExtensionsModule({
      loadMetadata: async () => current,
      loadAppearance: async () => emptyAppearance,
    }),
  );
  const writer = createDashboardSyncWriterProvider().getWriter("extension_events")!;
  try {
    await flushMicrotasks();
    await flushMicrotasks();
    expect(w.pageLocations.boot(projectId).ok).toBe(true);
    expect(w.pages.store.getState().location?.page).toEqual(first);
    current = { ...current, composition: { defaultPage: second, resourceOpeners: [{ resourceKind, opener: second }] } };
    writer.upsert({ id: "another-project", eventId: "pstdio.event.project-composition-changed", projectId: "another" });
    await flushMicrotasks();
    expect(getCachedDashboardExtensionMetadata(projectId)?.composition?.defaultPage).toEqual(first);
    writer.upsert({ id: "changed", eventId: "pstdio.event.project-composition-changed", projectId });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(w.pages.store.getState().location?.page).toEqual(first);
    expect(configuredResourceOpener(w as WorkbenchModuleContext, { type: "workspace", id: "one" })?.opener).toEqual(
      second,
    );
    await w.commands.executeCommand("workbench.page.openDefault");
    expect(w.pages.store.getState().location?.page).toEqual(second);
  } finally {
    extension.dispose();
    w.dispose();
  }
});
