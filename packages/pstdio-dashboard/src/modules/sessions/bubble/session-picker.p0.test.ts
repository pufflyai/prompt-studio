import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionsModule } from "../module";

test("session picker exposes the complete project source and navigates the invoking page", async () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: "picker-project", name: "Picker" });
  workbench.registerModule(createSessionsModule());
  const sessions = Array.from({ length: 65 }, (_, index) => ({
    id: `picker-${index}`,
    project_id: "picker-project",
    title: `History ${index}`,
    status: "completed",
  }));
  const writer = getWriter("sessions")!;
  writer.truncateAndWrite([
    ...sessions,
    { id: "other", project_id: "other-project", title: "Other", status: "completed" },
  ]);
  try {
    openSessionsPage(
      workbench,
      createDashboardResource("session", "picker-0", "History 0", "MessageCircle", "picker-project"),
    );
    const main = workbench.pages.getContent()!;
    await workbench.commands.executeCommand(dashboardCommandIds.switchSession, {
      placementIdentity: main.placementIdentity,
      from: main.resource,
    });
    const entries = workbench.commandPalette.store.getState().resourceSearch!.list("");
    expect(entries).toHaveLength(65);
    const entry = entries.find((entry) => entry.resource.id === "picker-64")!;
    await entry.activate!(entry.resource);
    expect(workbench.getPrimaryResource()?.id).toBe("picker-64");
    expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);
  } finally {
    writer.truncateAndWrite([]);
  }
});
