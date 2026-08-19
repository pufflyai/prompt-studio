import { expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadataWithTickets } from "./module-test-fixtures";

const ticket = {
  kind: "ticket",
  uri: "dashboard-workbench://ticket/PS-1",
  id: "PS-1",
  label: "PS-1 Ticket",
  metadata: { projectId: "project-1", shorthand: "PS-1" },
};

const menuPlacements = (workbench: ReturnType<typeof createWorkbenchCore>) =>
  workbench.layout.getLayout().regions["main-right-menu"].widgets.map((placement) => placement.contributionId);

test("reopening the active ticket keeps its properties menu", async () => {
  const workbench = createWorkbenchCore();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const disposable = workbench.registerModule(
    createExtensionsModule({ loadMetadata: mock(async () => metadataWithTickets) }),
  );

  try {
    await flushMicrotasks();
    await workbench.resources.openResource(ticket);
    expect(menuPlacements(workbench)).toHaveLength(1);

    // The ticket's sidenav entry re-opens the already-open ticket with replace-active.
    await workbench.resources.openResource(ticket, { replaceActive: true });

    expect(menuPlacements(workbench)).toHaveLength(1);
  } finally {
    disposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});
