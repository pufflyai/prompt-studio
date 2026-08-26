import { expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { createDashboardResource } from "@/shared/app/resources";
import { createSessionBubbleModule } from "./bubble/module";
import { createSessionsModule } from "./module";

test("sessions mode preserves the previous Location's Session Sub Panels", async () => {
  const workbench = createWorkbenchCore();
  const session = createDashboardResource("session", "session-1", "Session one", "MessageCircle", "project-1");
  workbench.layout.registerPanel({
    id: "dashboard.tickets",
    title: "Tickets",
    region: "main",
    rendererId: "dashboard.tickets",
  });
  workbench.views.registerView({ id: "tickets", panelId: "dashboard.tickets", title: "Tickets" });
  await workbench.views.openView("tickets");
  workbench.registerModule(createSessionBubbleModule());
  const sessionsModule = workbench.registerModule(createSessionsModule());

  try {
    const placement = await workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
      resource: session,
    });

    workbench.modes.setActiveMode("sessions");

    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({ widgetId: (placement as { instanceId: string }).instanceId }),
    ]);
  } finally {
    workbench.modes.setActiveMode(undefined);
    sessionsModule.dispose();
  }
});
