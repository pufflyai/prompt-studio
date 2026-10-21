import { describe, expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardSessionResource } from "@/shared/app/resources";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionBubbleModule } from "./bubble/module";
import { resolveDashboardSessionViewForPlacement } from "./data/dashboard-sessions";
import { createSessionsModule } from "./module";

const setup = () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionBubbleModule());
  workbench.registerModule(createSessionsModule());
  selectDashboardProject(workbench, { id: "session-close-project", name: "Session closing" });
  return workbench;
};

describe("closing a session page", () => {
  test("direct page navigation keeps the region chosen by the New session composer", () => {
    const workbench = setup();
    openSessionsPage(workbench);
    workbench.movePanel(workbench.layout.getActivePanel("main")!.instanceId, "side");
    for (const id of ["created-session", "selected-session"]) {
      expect(
        workbench.pageLocations.navigate({
          kind: "page",
          page: workbenchPages.session,
          resource: createDashboardSessionResource(id, id, "session-close-project"),
        }).ok,
      ).toBe(true);
      expect(workbench.layout.getActivePanel("side")?.resource?.id).toBe(id);
      expect(workbench.layout.listPanelInstances("main")).toEqual([]);
    }
  });
  for (const region of ["main", "side", "secondary"] as const) {
    test(`New session in ${region} can close and reopen from the New session action`, async () => {
      const workbench = setup();
      openSessionsPage(workbench);
      const original = workbench.layout.getActivePanel("main")!;
      if (region !== "main") workbench.movePanel(original.instanceId, region);
      expect(workbench.layout.getActivePanel(region)?.closable).toBe(true);
      workbench.closePlacement(original.placementIdentity!);
      expect(workbench.layout.listPanelInstances(region).some((item) => item.instanceId === original.instanceId)).toBe(
        false,
      );
      expect(workbench.pages.store.getState().location).toEqual({ page: workbenchPages.sessions });
      await workbench.commands.executeCommand(dashboardCommandIds.createSession);
      expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
    });
    test(`closing the selected session in ${region} returns to the new-session page`, () => {
      const workbench = setup();
      openSessionsPage(workbench);
      const newSession = workbench.layout.getActivePanel("main")!;
      openSessionsPage(
        workbench,
        createDashboardSessionResource("close-session", "Session X", "session-close-project"),
      );
      const session = workbench.layout.getActivePanel("main")!;
      if (region !== "main") workbench.movePanel(session.instanceId, region);
      expect(workbench.layout.getActivePanel(region)?.closable).toBe(true);
      workbench.closePlacement(session.placementIdentity!);
      expect(workbench.pages.store.getState().location).toEqual({ page: workbenchPages.sessions });
      const current = workbench.layout.getActivePanel(region)!;
      expect(current.instanceId).toBe(newSession.instanceId);
      expect(resolveDashboardSessionViewForPlacement(current).sessionId).toBeUndefined();
      expect(workbench.getPrimaryResource()).toBeUndefined();
    });
  }

  test("Sessions and New session select the same page and composer identity", async () => {
    const workbench = setup();
    openSessionsPage(workbench);
    const original = workbench.layout.getActivePanel("main")!;
    const location = workbench.pages.store.getState().location;
    await workbench.commands.executeCommand(dashboardCommandIds.createSession);
    expect(workbench.pages.store.getState().location).toEqual(location);
    expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
    openSessionsPage(workbench, { type: "session-draft", id: "another-draft", label: "New session" });
    expect(workbench.pages.store.getState().location).toEqual(location);
    expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
  });
});
