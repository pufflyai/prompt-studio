import { expect, test } from "bun:test";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardViews } from "@/shared/app/resources";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createDashboardWorkbench } from "../../workbench";

test("shortcut mode G then H returns to the project home", async () => {
  const core = createDashboardWorkbench();
  selectDashboardProject(core, { id: "project-1", name: "Project" });
  openWorkspacesPage(core);
  expect(core.pages.store.getState().activePageId).not.toBe(dashboardViews.start.id);
  core.keyboard.open();
  await core.keyboard.press("g");
  await core.keyboard.press("h");
  expect(core.pages.store.getState().activePageId).toBe(dashboardViews.start.id);
});
