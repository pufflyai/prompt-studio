import { describe, expect, mock, test } from "bun:test";
import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore, type ResourceRef, resourceContextMenuPath } from "@pstdio/workbench";
import { listWorkbenchMenuItems } from "@pstdio/workbench/react";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { publishExtensionCommandEvent } from "@/shared/extensions/extension-webview-broadcast";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadataWithTickets } from "./module-test-fixtures";

const ticketResource = {
  kind: "ticket",
  uri: "dashboard-workbench://ticket/PS-10",
  id: "PS-10",
  label: "PS-10 Ticket",
  icon: "component",
  metadata: { projectId: "project-1" },
} satisfies ResourceRef;

const mountTicketWorkbench = (metadata: DashboardExtensionMetadata) => {
  const workbench = createWorkbenchCore();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const disposable = workbench.registerModule(
    createExtensionsModule({
      loadMetadata: mock(async () => metadata),
      loadAppearance: mock(async () => emptyAppearance),
    }),
  );
  return { workbench, disposable };
};

describe("createExtensionsModule ticket reactivity", () => {
  test("surfaces ticket actions beside a ticket resource", async () => {
    const metadataWithTicketActions = {
      ...metadataWithTickets,
      commands: [
        ...metadataWithTickets.commands,
        { id: "pstdio-core-tickets.run-attempt", extensionId: "pstdio.pstdio-core-tickets", title: "Run attempt" },
      ],
      menuContributions: [
        ...metadataWithTickets.menuContributions,
        {
          id: "pstdio-core-tickets.run-attempt.menu.0",
          extensionId: "pstdio.pstdio-core-tickets",
          commandId: "pstdio-core-tickets.run-attempt",
          slotId: "ticket.headerPrimary",
          label: "Run attempt",
        },
      ],
    } satisfies DashboardExtensionMetadata;
    const { workbench, disposable } = mountTicketWorkbench(metadataWithTicketActions);

    try {
      await flushMicrotasks();
      await workbench.resources.openResource(ticketResource, { replaceActive: true });
      await flushMicrotasks();

      const resourceActions = listWorkbenchMenuItems(workbench, resourceContextMenuPath("ticket"), {
        resource: ticketResource,
      });
      expect(resourceActions.map((item) => item.label)).toContain("Run attempt");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("keeps ticket actions bound to their resource after resource-less header focus", async () => {
    const metadataWithTicketActions = {
      ...metadataWithTickets,
      commands: [
        ...metadataWithTickets.commands,
        { id: "pstdio-core-tickets.run-attempt", extensionId: "pstdio.pstdio-core-tickets", title: "Run attempt" },
      ],
      menuContributions: [
        ...metadataWithTickets.menuContributions,
        {
          id: "pstdio-core-tickets.run-attempt.menu.0",
          extensionId: "pstdio.pstdio-core-tickets",
          commandId: "pstdio-core-tickets.run-attempt",
          slotId: "ticket.headerPrimary",
          label: "Run attempt",
        },
      ],
    } satisfies DashboardExtensionMetadata;
    const { workbench, disposable } = mountTicketWorkbench(metadataWithTicketActions);

    try {
      workbench.layout.registerPanel({
        id: "test.global-header",
        title: "Global header",
        region: "nav",
        rendererId: "test.global-header",
      });
      workbench.layout.registerPanel({
        id: "test.dashboard-view",
        title: "Dashboard view",
        region: "main",
        rendererId: "test.dashboard-view",
      });

      await flushMicrotasks();
      await workbench.resources.openResource(ticketResource, { replaceActive: true });
      await flushMicrotasks();
      workbench.layout.openPanel("test.global-header");
      await flushMicrotasks();

      expect(workbench.context.get("workbench.resource.kind")).toBe("ticket");
      const resourceActions = listWorkbenchMenuItems(workbench, resourceContextMenuPath("ticket"), {
        resource: ticketResource,
      });
      expect(resourceActions.map((item) => item.label)).toContain("Run attempt");

      workbench.layout.openPanel("test.dashboard-view", {
        resource: { kind: "dashboard-view", uri: "dashboard-workbench://project/project-1/tickets", id: "tickets" },
      });
      const nonTicketResourceActions = listWorkbenchMenuItems(workbench, resourceContextMenuPath("dashboard-view"), {
        resource: workbench.getPrimaryResource(),
      });
      expect(nonTicketResourceActions.map((item) => item.label)).not.toContain("Run attempt");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("updates the ticket breadcrumb when a save changes the title", async () => {
    const { workbench, disposable } = mountTicketWorkbench(metadataWithTickets);

    try {
      await flushMicrotasks();
      await workbench.resources.openResource(ticketResource, { replaceActive: true });
      await flushMicrotasks();

      expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["PS-10 Ticket"]);

      publishExtensionCommandEvent({
        commandId: "pstdio-core-tickets.update-ticket",
        extensionId: "pstdio.pstdio-core-tickets",
        outcome: { ok: true, status: "success", value: { id: "PS-10", shorthand: "PS-10", title: "Write a haiku" } },
      });

      expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["PS-10 Write a haiku"]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("refreshes ticket tree renderers when a workspace row changes over the live feed", async () => {
    const { workbench, disposable } = mountTicketWorkbench(metadataWithTickets);
    const refreshed: string[] = [];
    const refreshSubscription = workbench.renderers.onDidRefresh((event) => refreshed.push(event.treeId));

    try {
      await flushMicrotasks();

      getWriter("workspaces")?.upsert({ id: "ws-1", project_id: "project-1" });
      await flushMicrotasks();

      expect(refreshed).toContain("pstdio-core-tickets.ticketFiles");
    } finally {
      refreshSubscription.dispose();
      disposable.dispose();
      getWriter("workspaces")?.truncateAndWrite([]);
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
