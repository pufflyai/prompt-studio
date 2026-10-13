import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionBubbleModule } from "./module";
import { openDashboardSessionPanel } from "./session-bubble";

for (const explicitlyClosed of [false, true]) {
  test(`session preview preserves owner intent with explicit Close ${explicitlyClosed}`, async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    workbench.registerModule(createSessionBubbleModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Project" });
    await openWorkspacesPage(workbench);
    if (explicitlyClosed) workbench.shell.setRegionOpen("side", false);
    const intent = workbench.layout.getLayout().regions.side.visibility;
    expect(workbench.sidePanel.getMode()).toBe("closed");
    await openDashboardSessionPanel(workbench, {
      resource: { type: "session", id: "session-1", label: "Session" },
      preservePanelMode: true,
    });
    expect(workbench.layout.listPanelInstances("side")).toHaveLength(1);
    expect(workbench.layout.getLayout().regions.side.visibility).toBe(intent);
    expect(workbench.sidePanel.getMode()).toBe(explicitlyClosed ? "closed" : "floating");
    await workbench.dispose();
  });
}
