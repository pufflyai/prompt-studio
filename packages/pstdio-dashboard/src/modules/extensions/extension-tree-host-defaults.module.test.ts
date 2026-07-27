import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { getSidenavContributionHeaderNodes } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { createSidenavModule } from "../sidenav/module";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadataWithTickets } from "./module-test-fixtures";

describe("createExtensionsModule tree host defaults", () => {
  test("keeps default sidenav header nodes out of extension tree views", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSidenavModule());
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const ticket = {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/PS-10",
        id: "PS-10",
        label: "PS-10 Ticket",
        metadata: { projectId: "project-1" },
      } satisfies ResourceRef;

      await workbench.resources.openResource(ticket, { replaceActive: true });

      expect(getSidenavContributionHeaderNodes(workbench, "ticket").map((node) => node.id)).toContain("search");
      await expect(
        workbench.renderers.getHeader("pstdio-core-tickets.ticketFiles", {
          resource: ticket,
          viewId: "pstdio-core-tickets.ticketFiles",
        }),
      ).resolves.toEqual([]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
