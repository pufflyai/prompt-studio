import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createBootstrapModule } from "../bootstrap";
import { createExtensionsModule } from "../extensions/module";
import { emptyAppearance, flushMicrotasks, metadataWithResourceExtension } from "../extensions/module-test-fixtures";
import { createSessionsModule } from "../sessions/module";
import { createStartModule } from "../start/module";
import { DesktopProjectTabsController } from "./desktop-project-tabs-controller";
import { createProjectsModule } from "./module";

test("project tabs preserve each extension page when switching, closing, and reopening projects", async () => {
  const workbench = createWorkbench();
  const tabs = new DesktopProjectTabsController([], async () => {});
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  getWriter("projects")?.truncateAndWrite([
    { id: "first", name: "First" },
    { id: "second", name: "Second" },
  ]);
  markInitialCollectionsSyncComplete();
  const modules = [
    createExtensionsModule({
      loadAppearance: async () => emptyAppearance,
      loadMetadata: async () => metadataWithResourceExtension,
    }),
    createProjectsModule({ projectTabs: tabs }),
    createSessionsModule(),
    createStartModule(),
    createBootstrapModule(),
  ].map((module) => workbench.registerModule(module));
  const select = async (id: string) => {
    await tabs.select(workbench, id);
    await flushMicrotasks();
    await flushMicrotasks();
  };
  const firstPage = { extensionId: "pstdio.extension-lab", kind: "page", id: "labPage" } as const;
  const secondPage = { extensionId: "acme.issue-tracker", kind: "page", id: "issue" } as const;
  try {
    await select("first");
    expect(workbench.pageLocations.navigate({ kind: "page", page: firstPage }).ok).toBe(true);
    const firstLocation = workbench.pages.store.getState().location;
    await select("second");
    expect(
      workbench.pageLocations.navigate({
        kind: "page",
        page: secondPage,
        resource: { type: "issue", id: "issue-2" },
      }),
    ).toMatchObject({ ok: true });
    const secondLocation = workbench.pages.store.getState().location;
    await select("first");
    expect(workbench.pages.store.getState().location).toEqual(firstLocation);
    await select("second");
    expect(workbench.pages.store.getState().location).toEqual(secondLocation);
    const sessionsPage = { extensionId: "pstdio", kind: "page", id: "sessions" } as const;
    expect(workbench.pageLocations.navigate({ kind: "page", page: sessionsPage }).ok).toBe(true);
    await select("first");
    await select("second");
    expect(workbench.pages.store.getState().location?.page).toEqual(sessionsPage);
    expect(workbench.pageLocations.replay(secondLocation!).ok).toBe(true);
    await tabs.close(workbench, "first");
    await tabs.close(workbench, "second");
    await select("second");
    expect(workbench.pages.store.getState().location).toEqual(secondLocation);
  } finally {
    workbench.pageLocations.clearProject();
    for (const module of modules.reverse()) module.dispose();
    getWriter("projects")?.truncateAndWrite([]);
    for (const id of ["first", "second"]) clearCachedDashboardExtensionMetadata(id);
  }
});
