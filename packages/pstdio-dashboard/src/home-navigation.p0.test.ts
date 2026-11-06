import { expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import type { WorkbenchPageLocationBrowser } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { setDashboardExtensionsReadyProject } from "@/shared/extensions/extension-readiness";
import { registerWorkspaceProviderViews } from "@/workspaces-provider.test-support";
import { registerHomePage as registerHome } from "./home-page.test-support";
import { createDashboardWorkbench } from "./workbench";

const home = { kind: "page" as const, extensionId: "pstdio.pstdio-home", id: "home" };
const browserAt = (url: string): WorkbenchPageLocationBrowser => {
  let current = { url };
  return {
    current: () => current,
    push: (entry) => {
      current = entry;
    },
    replace: (entry) => {
      current = entry;
    },
    back() {},
    forward() {},
    onPopState: () => ({ dispose() {} }),
  };
};
const createProject = () => {
  const workbench = createDashboardWorkbench({ pageLocationBrowser: browserAt("/projects/project-1") });
  registerWorkspaceProviderViews(workbench);
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  return workbench;
};

test("project mode directly defaults to Home among ordinary registered pages", async () => {
  const workbench = createProject();
  registerHome(workbench);
  workbench.pages.registerPage({
    id: "acme.tools",
    ref: { kind: "page", extensionId: "acme", id: "tools" },
    path: "tools",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  setDashboardExtensionsReadyProject(workbench, "project-1");
  expect(workbench.pages.store.getState().location?.page).toEqual(home);
  await workbench.dispose();
});

test("switching projects restores a saved destination before the Home default", async () => {
  const workbench = createProject();
  registerHome(workbench);
  setDashboardExtensionsReadyProject(workbench, "project-1");
  expect(workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.workspaces }).ok).toBe(true);
  expect(workbench.pageLocations.switchProject("project-2").ok).toBe(true);
  expect(workbench.pages.store.getState().location?.page).toEqual(home);
  expect(workbench.pageLocations.switchProject("project-1").ok).toBe(true);
  expect(workbench.pages.store.getState().location?.page).toEqual(workbenchPages.workspaces);
  await workbench.dispose();
});

test("unavailable Home leaves project mode empty and normal pages remain usable", async () => {
  const workbench = createProject();
  setDashboardExtensionsReadyProject(workbench, "project-1");
  expect(workbench.modes.getActiveModeId()).toBe("project");
  expect(workbench.pages.store.getState().location).toBeUndefined();
  expect(workbench.pages.getContent()).toBeUndefined();
  expect(workbench.layout.getPlaceholder("main")).toBeUndefined();
  expect(workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.workspaces }).ok).toBe(true);
  await workbench.dispose();
});

test("unloading Home leaves the existing empty panel and re-enabling allows ordinary navigation", async () => {
  const workbench = createProject();
  const installed = registerHome(workbench);
  setDashboardExtensionsReadyProject(workbench, "project-1");
  installed.dispose();
  expect(workbench.pages.store.getState().location).toBeUndefined();
  expect(workbench.modes.getActiveModeId()).toBe("project");
  expect(workbench.pages.getContent()).toBeUndefined();
  registerHome(workbench);
  expect(workbench.pageLocations.navigate({ kind: "page", page: home }).ok).toBe(true);
  expect(workbench.pages.store.getState().location?.page).toEqual(home);
  await workbench.dispose();
});
