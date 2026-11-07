import { expect, test } from "bun:test";
import { contributionRefId, sessionBrowser } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { openWorkspaceFixture, registerWorkspaceProviderViews } from "@/workspaces-provider.test-support";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionsModule } from "../module";
import { registerSessionProvider } from "../session-provider.fixture";

test("new session in an open tab targets the chosen presentation without adding a tab", async () => {
  const core = createWorkbench();
  registerWorkspaceProviderViews(core);
  core.registerModule(createWorkspacesModule());
  core.registerModule(createSessionsModule());
  registerSessionProvider(core);
  selectDashboardProject(core, { id: "project-1", name: "Project" });
  openWorkspaceFixture(core);
  await core.commands.executeCommand(dashboardCommandIds.createSession, undefined, {
    source: "panel-add",
    region: "side",
  });
  const before = core.layout
    .listPanelInstances("side")
    .find((tab) => tab.viewId === contributionRefId(sessionBrowser.views.conversation))!;
  core.keyboard.open();
  await core.keyboard.press("a");
  await core.keyboard.press("n");
  const after = core.layout
    .listPanelInstances("side")
    .find((tab) => tab.viewId === contributionRefId(sessionBrowser.views.conversation))!;
  expect(after.instanceId).toBe(before.instanceId);
  expect(after.resource?.id).not.toBe(before.resource?.id);
  expect(core.layout.listPanelInstances("side")).toHaveLength(1);
});
