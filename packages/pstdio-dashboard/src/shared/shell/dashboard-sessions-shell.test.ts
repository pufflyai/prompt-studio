import { describe, expect, it } from "bun:test";
import { workbenchTopHeaderTrailingMenuPath } from "pstdio-shell/core";
import { PROJECT_NAVIGATION_HEADER_WIDGET_ID } from "./dashboard-project-shell";
import {
  createDashboardSessionsShell,
  createSessionResource,
  createSessionsResource,
  SESSION_RESOURCE_KIND,
  SESSIONS_CHAT_WIDGET_ID,
  SESSIONS_CREATE_COMMAND_ID,
  SESSIONS_MODE_ID,
  SESSIONS_NAVIGATION_TREE_ID,
  SESSIONS_OPEN_COMMAND_ID,
  SESSIONS_RESOURCE_KIND,
} from "./dashboard-sessions-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

describe("createDashboardSessionsShell", () => {
  it("registers the sessions shell slice and opens session resources", async () => {
    const navigations: string[] = [];
    const shell = createDashboardSessionsShell({
      projectId: "proj-1",
      projectName: "Demo project",
      selectedSessionId: "session-1",
      navigation: {
        current: {
          getSections: () => [],
        },
      },
      navigate: (path) => navigations.push(path),
    });

    expect(shell.resources.getKind(SESSIONS_RESOURCE_KIND)?.source).toBe("product-module");
    expect(shell.resources.getKind(SESSION_RESOURCE_KIND)?.source).toBe("product-module");
    expect(shell.modes.getActiveModeId()).toBe(SESSIONS_MODE_ID);
    expect(shell.trees.getTreeView(SESSIONS_NAVIGATION_TREE_ID)).toMatchObject({
      area: "left",
      icon: "MessageCircle",
    });
    expect(shell.layout.getWidget(SESSIONS_CHAT_WIDGET_ID)).toMatchObject({
      area: "main",
      renderer: "react",
    });
    expect(shell.layout.getLayout().areas["left-header"].widgets.map((widget) => widget.contributionId)).toEqual([
      PROJECT_NAVIGATION_HEADER_WIDGET_ID,
    ]);
    expect(shell.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
      SESSIONS_CHAT_WIDGET_ID,
    ]);
    expect(shell.commands.getCommand(SESSIONS_OPEN_COMMAND_ID)?.command.label).toBe("Open sessions");
    expect(shell.commands.getCommand(SESSIONS_CREATE_COMMAND_ID)?.command.label).toBe("New session");
    expect(shell.menus.listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU).map((action) => action.commandId)).toEqual(
      expect.arrayContaining([SESSIONS_OPEN_COMMAND_ID, SESSIONS_CREATE_COMMAND_ID]),
    );
    expect(
      shell.menus.listMenuActions(workbenchTopHeaderTrailingMenuPath).map((action) => action.commandId),
    ).not.toContain(SESSIONS_CREATE_COMMAND_ID);

    expect(shell.layout.getLayout().areas.left.widgets).toEqual([]);
    expect(shell.layout.getLayout().activeWidgetId).toBe(SESSIONS_CHAT_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/session/session-1");

    await shell.resources.openResource(createSessionsResource("proj-1"));
    await shell.resources.openResource(createSessionResource("proj-1", "session-2", "Follow-up"));

    expect(navigations).toEqual(["/projects/proj-1/sessions", "/projects/proj-1/sessions/session-2"]);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/session/session-2");

    shell.dispose();

    expect(shell.commands.getCommand(SESSIONS_OPEN_COMMAND_ID)).toBeUndefined();
    expect(shell.commands.getCommand(SESSIONS_CREATE_COMMAND_ID)).toBeUndefined();
  });
});
