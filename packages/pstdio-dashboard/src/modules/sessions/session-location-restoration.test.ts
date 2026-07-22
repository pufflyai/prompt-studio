import { expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { createDashboardResource } from "@/shared/app/resources";
import { createSessionBubbleModule } from "./bubble/module";
import { createSessionsModule } from "./module";

test("sessions mode preserves the previous Location's Session Sub Panels", async () => {
  const workbench = createWorkbenchCore();
  const location = createDashboardResource("dashboard-view", "tickets", "Tickets", "List", "project-1");
  const session = createDashboardResource("session", "session-1", "Session one", "MessageCircle", "project-1");
  workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
  workbench.layout.registerLocation({
    id: "dashboard.tickets",
    title: "Tickets",
    region: "main",
    rendererId: "dashboard.tickets",
  });
  workbench.layout.openWidget("dashboard.tickets", { resource: location });
  workbench.registerModule(createSessionBubbleModule());
  const sessionsModule = workbench.registerModule(createSessionsModule());

  try {
    const placement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: session,
    });

    workbench.modes.setActiveMode("sessions");

    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({ widgetId: (placement as { widgetId: string }).widgetId }),
    ]);
  } finally {
    workbench.modes.setActiveMode(undefined);
    sessionsModule.dispose();
  }
});
