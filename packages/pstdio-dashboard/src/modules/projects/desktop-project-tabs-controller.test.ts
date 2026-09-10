import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { DesktopProjectTabsController } from "./desktop-project-tabs-controller";
import { createProjectsModule } from "./module";

const disposals: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
  getWriter("projects")?.truncateAndWrite([]);
});

const setup = (ids = ["first", "second"], openIds: string[] = []) => {
  const workbench = createWorkbench();
  const writes: string[][] = [];
  const tabs = new DesktopProjectTabsController(openIds, async (state) => {
    writes.push(state.projectIds);
  });
  getWriter("projects")?.truncateAndWrite(ids.map((id) => ({ id, name: id })));
  const projects = workbench.registerModule(createProjectsModule({ projectTabs: tabs }));
  disposals.push(() => projects.dispose());
  markInitialCollectionsSyncComplete();
  const select = (id: string) =>
    workbench.commands.executeCommand(dashboardCommandIds.selectProject, { project: { id, name: id } });
  return { workbench, tabs, writes, select };
};

test("picker and tab selection share the existing project command and ordered list", async () => {
  const { workbench, tabs, select } = setup();
  await select("first");
  await select("second");
  await tabs.select(workbench, "first");
  expect(tabs.getProjectIds()).toEqual(["first", "second"]);
  expect(getDashboardSelectedProjectId(workbench)).toBe("first");
  await tabs.close(workbench, "first");
  expect(tabs.getProjectIds()).toEqual(["second"]);
  expect(getDashboardSelectedProjectId(workbench)).toBe("second");
  expect(getWriter("projects")).toBeDefined();
});

test("reordering saves the new tab order without changing the selected project", async () => {
  const { workbench, tabs, writes, select } = setup(["first", "second", "third"], ["first", "second", "third"]);
  await select("second");
  tabs.reorder(workbench, "first", "third");
  expect(tabs.getProjectIds()).toEqual(["second", "third", "first"]);
  expect(getDashboardSelectedProjectId(workbench)).toBe("second");
  expect(writes.at(-1)).toEqual(["second", "third", "first"]);
  tabs.reorder(workbench, "first", "second");
  expect(tabs.getProjectIds()).toEqual(["first", "second", "third"]);
  await tabs.close(workbench, "second");
  expect(getDashboardSelectedProjectId(workbench)).toBe("third");
});

test("closing the last tab keeps project selection open when project data changes", async () => {
  const { workbench, tabs, select } = setup(["first"]);
  await select("first");
  await tabs.close(workbench, "first");
  getWriter("projects")?.upsert({ id: "first", name: "Renamed project" });
  expect(getDashboardSelectedProjectId(workbench)).toBeUndefined();
  expect(workbench.modes.getActiveModeId()).toBe("project-selection");
  expect(tabs.getProjectIds()).toEqual([]);
});

test("hydrates order after sync and removes deleted tabs with a selection fallback", async () => {
  const { workbench, tabs, select } = setup(["first", "second"], ["second", "deleted", "first"]);
  expect(tabs.getProjectIds()).toEqual(["second", "first"]);
  await select("second");
  getWriter("projects")?.remove("second");
  await Promise.resolve();
  expect(tabs.getProjectIds()).toEqual(["first"]);
  expect(getDashboardSelectedProjectId(workbench)).toBe("first");
});

test("reports a failed tab write and clears the error after the next saved change", async () => {
  const home = mkdtempSync(join(tmpdir(), "project-tabs-persistence-"));
  disposals.push(() => rmSync(home, { recursive: true, force: true }));
  const blockedDirectory = join(home, "app-data");
  writeFileSync(blockedDirectory, "blocks the application data directory");
  const path = join(blockedDirectory, "project-tabs.json");
  const workbench = createWorkbench();
  let save: Promise<void> = Promise.resolve();
  const tabs = new DesktopProjectTabsController([], (state) => {
    save = Bun.write(path, JSON.stringify(state)).then(() => {});
    return save;
  });
  getWriter("projects")?.truncateAndWrite([{ id: "first", name: "First" }]);
  const projects = workbench.registerModule(createProjectsModule({ projectTabs: tabs }));
  disposals.push(() => projects.dispose());
  markInitialCollectionsSyncComplete();

  await tabs.select(workbench, "first");
  await expect(save).rejects.toThrow();
  expect(tabs.getProjectIds()).toEqual(["first"]);
  expect(workbench.notifications.listNotifications()).toMatchObject([{ level: "error" }]);

  rmSync(blockedDirectory);
  await tabs.close(workbench, "first");
  await save;
  expect(await Bun.file(path).json()).toEqual({ projectIds: [] });
  expect(workbench.notifications.listNotifications()).toEqual([]);
});
