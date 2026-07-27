import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import {
  createWorkbenchCore,
  type ResourceRef,
  workbenchSelectionResourceUriMetadataKey,
} from "@pstdio/workbench/core";
import { describeResourceRouteContract } from "@pstdio/workbench/testing";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { subscribeToExtensionCommandFeed } from "@/shared/extensions/extension-webview-broadcast";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { getSidenavContributionHeaderNodes } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { createWorkspacesModule } from "../workspaces/module";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadataWithTickets, response } from "./module-test-fixtures";

describe("createExtensionsModule resource views", () => {
  test("restores the Tickets Location through Back after opening a ticket", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const ticketsBoard = getSidenavContributionHeaderNodes(workbench, "project").find(
        (node) => node.resource?.id === "pstdio-core-tickets.tickets",
      )?.resource;
      const ticket = {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/PS-10",
        id: "PS-10",
        label: "PS-10 Ticket",
        metadata: { projectId: "project-1" },
      } satisfies ResourceRef;

      await workbench.resources.openResource(ticketsBoard!);
      await workbench.resources.openResource(ticket, { replaceActive: true });

      expect(workbench.getPrimaryResource()?.metadata?.[workbenchSelectionResourceUriMetadataKey]).toBe(
        ticketsBoard?.uri,
      );

      const breadcrumbs = workbench.breadcrumbs.getItems();
      expect(breadcrumbs?.map((item) => item.title)).toEqual(["Tickets", "PS-10 Ticket"]);
      breadcrumbs?.[0]?.onClick?.();
      await flushMicrotasks();

      expect(workbench.layout.getLayout().activeWidgetId).toBe("pstdio-core-tickets.tickets");
      expect(workbench.layout.getLayout().activeResourceUri).toBe(ticketsBoard?.uri);

      await workbench.resources.openResource(ticket, { replaceActive: true });
      const back = workbench.history.goBack();
      await flushMicrotasks();

      expect(back?.resource?.uri).toBe(ticketsBoard?.uri);
      expect(workbench.getPrimaryResource()?.uri).toBe(ticketsBoard?.uri);

      const forward = workbench.history.goForward();
      await flushMicrotasks();

      expect(forward?.resource?.uri).toBe(ticket.uri);
      expect(workbench.getPrimaryResource()?.uri).toBe(ticket.uri);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("opens ticket detail with its attached Properties Panel Menu", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const loadAppearance = mock(async () => emptyAppearance);
    const executeCommand = mock(async () => response);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(
      createExtensionsModule({ executeCommand, loadMetadata, loadAppearance }),
    );

    try {
      await flushMicrotasks();

      const ticket = {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/PS-10",
        id: "PS-10",
        label: "PS-10 Ticket",
        metadata: { projectId: "project-1" },
      } satisfies ResourceRef;
      const ticketB = {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/PS-11",
        id: "PS-11",
        label: "PS-11 Ticket",
        metadata: { projectId: "project-1" },
      } satisfies ResourceRef;

      await workbench.resources.openResource(ticket, { replaceActive: true });

      expect(workbench.modes.getActiveModeId()).toBe("pstdio-core-tickets.ticket");
      expect(workbench.renderers.getTreeRenderer("pstdio-core-tickets.ticketFiles")).toMatchObject({
        title: "Files",
      });
      expect(
        workbench.layout.getLayout().regions["main-right-menu"].widgets.map((widget) => widget.contributionId),
      ).toEqual(["dashboard-workbench.extension-view.pstdio-core-tickets.ticketProperties"]);

      await workbench.resources.openResource(ticketB, { replaceActive: true });

      const rightMenu = workbench.layout.getLayout().regions["main-right-menu"];

      expect(rightMenu.widgets.map((widget) => widget.resource?.id)).toEqual(["PS-11"]);
      expect(rightMenu.widgets.find((widget) => widget.widgetId === rightMenu.activeWidgetId)?.resource?.id).toBe(
        "PS-11",
      );
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("publishes ticket file selection commands from the files tree", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const loadAppearance = mock(async () => emptyAppearance);
    const responses: Record<string, CommandExecuteResponse> = {
      "pstdio-core-tickets.ticket-files.tree.body": {
        commandId: "pstdio-core-tickets.ticket-files.tree.body",
        extensionId: "pstdio.pstdio-core-tickets",
        outcome: {
          ok: true,
          status: "success",
          value: [
            {
              id: "files",
              nodes: [
                {
                  id: "file-1",
                  label: "notes.md",
                  target: {
                    kind: "command",
                    commandId: "pstdio-core-tickets.select-ticket-file",
                    args: { ticketId: "PS-10", fileId: "file-1" },
                  },
                },
              ],
            },
          ],
        },
      },
      "pstdio-core-tickets.select-ticket-file": {
        commandId: "pstdio-core-tickets.select-ticket-file",
        extensionId: "pstdio.pstdio-core-tickets",
        outcome: { ok: true, status: "success", value: { ticketId: "PS-10", fileId: "file-1" } },
      },
    };
    const executeCommand = mock(async (_projectId: string, commandId: string) => {
      const response = responses[commandId];
      if (!response) throw new Error(`Unexpected command: ${commandId}`);
      return response;
    });
    const workbench = createWorkbenchCore();
    const events: string[] = [];

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(
      createExtensionsModule({ executeCommand, loadMetadata, loadAppearance }),
    );
    const unsubscribe = subscribeToExtensionCommandFeed((event) => events.push(event.commandId));

    try {
      await flushMicrotasks();

      const ticket = {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/PS-10",
        id: "PS-10",
        label: "PS-10 Ticket",
        metadata: { projectId: "project-1" },
      } satisfies ResourceRef;

      const body = await workbench.renderers.getBody("pstdio-core-tickets.ticketFiles", { resource: ticket });
      const target = body[0]?.nodes[0]?.target;
      expect(target).toBeDefined();

      await workbench.navigation.openTarget(target!);

      expect(events).toContain("pstdio-core-tickets.select-ticket-file");
    } finally {
      unsubscribe();
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("clears the ticket Properties Panel Menu when returning to the tickets board", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const loadAppearance = mock(async () => emptyAppearance);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

    try {
      await flushMicrotasks();

      const ticketsBoard = getSidenavContributionHeaderNodes(workbench, "project").find(
        (node) => node.resource?.id === "pstdio-core-tickets.tickets",
      )?.resource;
      const ticket = {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/PS-10",
        id: "PS-10",
        label: "PS-10 Ticket",
        metadata: { projectId: "project-1" },
      } satisfies ResourceRef;

      await workbench.resources.openResource(ticket, { replaceActive: true });

      expect(workbench.modes.getActiveModeId()).toBe("pstdio-core-tickets.ticket");
      expect(workbench.layout.getLayout().regions["main-right-menu"].widgets).toHaveLength(1);

      await workbench.resources.openResource(ticketsBoard!, { replaceActive: true });

      expect(workbench.modes.getActiveModeId()).toBe("project");
      expect(workbench.layout.getLayout().regions["main-right-menu"].widgets).toEqual([]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});

describe("createExtensionsModule ticket breadcrumbs", () => {
  test("walks three-level ticket ancestry from canonical resource parent edges", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const childTicket = {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/PS-11",
        id: "PS-11",
        label: "PS-11 Child",
        metadata: {
          projectId: "project-1",
          resourceParent: {
            type: "ticket",
            id: "PS-10",
            label: "PS-10 Parent",
            metadata: {
              shorthand: "PS-10",
              resourceParent: {
                type: "ticket",
                id: "PS-9",
                label: "PS-9 Root",
                metadata: { shorthand: "PS-9" },
              },
            },
          },
        },
      } satisfies ResourceRef;

      await workbench.resources.openResource(childTicket, { replaceActive: true });

      const breadcrumbs = workbench.breadcrumbs.getItems();
      expect(breadcrumbs?.map((item) => item.title)).toEqual(["Tickets", "PS-9 Root", "PS-10 Parent", "PS-11 Child"]);
      expect(breadcrumbs?.[2]?.resource).toMatchObject({
        kind: "ticket",
        id: "PS-10",
        label: "PS-10 Parent",
        icon: "component",
      });
      expect(breadcrumbs?.[2]?.icon).toBe("component");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("navigates parent to child to linked workspace and back through resource history", async () => {
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(
      createExtensionsModule({ loadMetadata: mock(async () => metadataWithTickets) }),
    );

    try {
      await flushMicrotasks();

      const parent = {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/PS-10",
        id: "PS-10",
        label: "PS-10 Parent",
        metadata: { projectId: "project-1" },
      } satisfies ResourceRef;
      const child = {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/PS-11",
        id: "PS-11",
        label: "PS-11 Child",
        metadata: {
          projectId: "project-1",
          resourceParent: {
            type: "ticket",
            id: parent.id,
            label: parent.label,
            metadata: { shorthand: parent.id },
          },
        },
      } satisfies ResourceRef;
      const workspace = createDashboardResource("workspace", "workspace-ps173", "PS-11_A1", "GitBranch", "project-1", {
        workspaceId: "workspace-ps173",
        resourceParent: {
          type: "ticket",
          id: child.id,
          label: child.label,
          metadata: child.metadata,
        },
      });

      await workbench.resources.openResource(parent, { replaceActive: true });
      await workbench.resources.openResource(child, { replaceActive: true });
      await workbench.resources.openResource(workspace, { replaceActive: true });

      expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual([
        "Tickets",
        "PS-10 Parent",
        "PS-11 Child",
        "PS-11_A1",
      ]);

      workbench.history.goBack();
      await flushMicrotasks();
      expect(workbench.getPrimaryResource()?.id).toBe(child.id);
      expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual([
        "Tickets",
        "PS-10 Parent",
        "PS-11 Child",
      ]);

      workbench.history.goBack();
      await flushMicrotasks();
      expect(workbench.getPrimaryResource()?.id).toBe(parent.id);
    } finally {
      disposable.dispose();
    }
  });
});

// The ticket editor places the domain ticket resource with the view derived at render time,
// so the contract guards that Back/Forward stay resource-first across board/detail modes.
describeResourceRouteContract({
  name: "tickets",
  setup: async () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(
      createExtensionsModule({ loadMetadata: mock(async () => metadataWithTickets) }),
    );
    await flushMicrotasks();
    return {
      workbench,
      dispose: () => {
        disposable.dispose();
        clearCachedDashboardExtensionMetadata("project-1");
      },
    };
  },
  root: {
    kind: "dashboard-view",
    uri: "dashboard-workbench://dashboard-view/pstdio-core-tickets.tickets",
    id: "pstdio-core-tickets.tickets",
    label: "Tickets",
    metadata: { projectId: "project-1", kanbanRendererId: "pstdio-core-tickets.tickets" },
  },
  detail: {
    kind: "ticket",
    uri: "dashboard-workbench://ticket/PS-10",
    id: "PS-10",
    label: "PS-10 Ticket",
    metadata: { projectId: "project-1" },
  },
  detailB: {
    kind: "ticket",
    uri: "dashboard-workbench://ticket/PS-11",
    id: "PS-11",
    label: "PS-11 Ticket",
    metadata: { projectId: "project-1" },
  },
  rootDetailHistory: "replaced",
});
