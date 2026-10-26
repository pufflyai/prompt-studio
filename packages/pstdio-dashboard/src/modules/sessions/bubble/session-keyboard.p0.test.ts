import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionsModule } from "../module";

test("new session in an open tab targets the chosen presentation without adding a tab", async () => {
  const core = createWorkbench();
  core.registerModule(createWorkspacesModule());
  core.registerModule(createSessionsModule());
  selectDashboardProject(core, { id: "project-1", name: "Project" });
  openWorkspacesPage(core);
  await core.commands.executeCommand(dashboardCommandIds.createSession, undefined, {
    source: "panel-add",
    region: "side",
  });
  const before = core.layout.listPanelInstances("side").find((tab) => tab.viewId === dashboardWidgetIds.sessionBubble)!;
  core.keyboard.open();
  await core.keyboard.press("a");
  await core.keyboard.press("n");
  const after = core.layout.listPanelInstances("side").find((tab) => tab.viewId === dashboardWidgetIds.sessionBubble)!;
  expect(after.instanceId).toBe(before.instanceId);
  expect(after.resource?.id).not.toBe(before.resource?.id);
  expect(core.layout.listPanelInstances("side")).toHaveLength(1);
});
