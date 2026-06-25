import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "pstdio-workbench/core";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createSidebarModule } from "../sidebar/module";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadataWithTickets } from "./module-test-fixtures";

describe("createExtensionsModule tree host defaults", () => {
  test("adds the default sidebar header to opted-in ticket tree views", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.registerModule(createSidebarModule());
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

      await expect(
        workbench.renderers.getHeader("pstdio-core-tickets.ticketFiles", {
          resource: ticket,
          viewId: "pstdio-core-tickets.ticketFiles",
        }),
      ).resolves.toEqual([
        expect.objectContaining({
          id: "search",
          label: "Search",
          icon: "Search",
        }),
      ]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
