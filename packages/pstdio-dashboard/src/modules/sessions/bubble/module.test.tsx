import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createSessionBubbleModule } from "./module";

describe("createSessionBubbleModule", () => {
  test("opens a workspace-linked session draft from the create session command", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSessionBubbleModule());

    await workbench.commands.executeCommand(dashboardCommandIds.createSession, { workspace });

    const placement = workbench.layout
      .getLayout()
      .areas.floating.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble);

    expect(placement?.resource?.kind).toBe("session-draft");
    expect(placement?.resource?.metadata?.workspaceId).toBe("workspace-1");
    expect(placement?.resource?.metadata?.workspaceShorthand).toBe("PS-307_A1");
  });

  test("opens the session bubble header with the same draft resource", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSessionBubbleModule());

    await workbench.commands.executeCommand(dashboardCommandIds.createSession, { workspace });

    const headerPlacement = workbench.layout
      .getLayout()
      .areas["floating-header"].widgets.find(
        (widget) => widget.contributionId === dashboardWidgetIds.sessionBubbleHeader,
      );

    expect(headerPlacement?.resource?.kind).toBe("session-draft");
    expect(headerPlacement?.resource?.metadata?.workspaceId).toBe("workspace-1");
  });
});
