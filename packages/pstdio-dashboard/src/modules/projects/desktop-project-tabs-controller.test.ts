import { afterEach, expect, test } from "bun:test";
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
