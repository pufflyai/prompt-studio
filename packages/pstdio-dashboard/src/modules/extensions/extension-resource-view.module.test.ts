import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore, type ResourceRef, workbenchSelectionResourceUriMetadataKey } from "@pstdio/workbench";
import { describeResourceRouteContract } from "@pstdio/workbench/testing";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { subscribeToExtensionCommandFeed } from "@/shared/extensions/extension-webview-broadcast";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { getSidenavContributionHeaderNodes } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { createWorkspacesModule } from "../workspaces/module";
import { createExtensionsModule } from "./module";
import {
  emptyAppearance,
  flushMicrotasks,
  metadataWithLabMode,
  metadataWithTickets,
  response,
} from "./module-test-fixtures";

describe("createExtensionsModule resource inspectors", () => {
  test("opens side-only resource kinds as inspectors without leaving the active mode", async () => {
    const inspectorMetadata = {
      ...metadataWithTickets,
      modes: [],
      kanbanRenderers: [],
      treeRenderers: [],
      panels: [
        {
          id: "extension-lab.labArtifactDetail",
          extensionId: "pstdio.extension-lab",
          title: "Artifact",
          icon: "package-search",
          region: "side" as const,
          closable: true,
          resourceKind: "glass-lab-artifact",
          webview: {
            entry: {
              kind: "package-asset" as const,
              path: "./src/views/lab-artifact.tsx",
              baseUrl: "file:///extension/extension.ts",
            },
            runtimeUrl: "/v1/extensions/runtime",
            moduleUrl: "/v1/extensions/installed/extension-lab/webviews/lab-artifact/module.js",
          },
        },
      ],
    };
    const loadMetadata = mock(async () => inspectorMetadata);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.modes.setActiveMode("project");
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const artifact = {
        kind: "glass-lab-artifact",
        uri: "dashboard-workbench://glass-lab-artifact/artifact-1",
        id: "artifact-1",
        label: "Sealed Observation mirror",
        metadata: { projectId: "project-1" },
      } satisfies ResourceRef;
      const primaryBefore = workbench.getPrimaryResource();

      await workbench.resources.openResource(artifact, { replaceActive: true });

      const side = workbench.layout.getLayout().regions.side;
      expect(side.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labArtifactDetail",
      ]);
      expect(side.widgets[0]?.resource?.id).toBe("artifact-1");
      expect(workbench.sidePanel.getMode()).toBe("attached");
      // Inspectors open in place: no mode switch, no navigation change.
      expect(workbench.modes.getActiveModeId()).toBe("project");
      expect(workbench.getPrimaryResource()?.uri).toBe(primaryBefore?.uri);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});

describe("createExtensionsModule resource views", () => {
  test("opens a persistent resource editor as a tab in its current extension mode location", async () => {
    const resourceMetadata = {
      ...metadataWithLabMode,
      panels: [
        ...metadataWithLabMode.panels,
        {
          id: "extension-lab.labArtifactReport",
          extensionId: "pstdio.extension-lab",
          title: "Artifact report",
          icon: "chart-no-axes-combined",
          region: "main" as const,
          closable: true,
          resourceKind: "glass-lab-artifact",
          eligibleLocations: { resourceKinds: ["extension-view"] },
          webview: {
            entry: {
              kind: "package-asset" as const,
              path: "./src/views/lab-artifact.tsx",
              baseUrl: "file:///extension/extension.ts",
            },
            runtimeUrl: "/v1/extensions/runtime",
            moduleUrl: "/v1/extensions/installed/extension-lab/webviews/lab-artifact/module.js",
          },
        },
      ],
    };
    const loadMetadata = mock(async () => resourceMetadata);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();
      workbench.modes.setActiveMode("pstdio.extension-lab.lab");
      const overview = workbench.getPrimaryResource();

      await workbench.resources.openResource({
        kind: "glass-lab-artifact",
        uri: "pstdio://extension-resource/glass-lab-artifact/artifact-1",
        id: "artifact-1",
        label: "Artifact 1",
      });

      expect(workbench.modes.getActiveModeId()).toBe("pstdio.extension-lab.lab");
      expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.resource?.label)).toEqual([
        "Lab overview",
        "Artifact 1",
      ]);
      expect(workbench.layout.getLayout().activeLocationWidgetId).toBe(
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      );
      expect(workbench.getPrimaryResource()).toEqual(overview);
      expect(workbench.layout.getActivePanel("main")?.resource?.label).toBe("Artifact 1");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("replaces an eligible extension-mode tab without leaving that mode", async () => {
    const resourceMetadata = {
      ...metadataWithLabMode,
      modes: metadataWithLabMode.modes.map((mode) => ({
        ...mode,
        layout: {
          ...mode.layout,
          open: [...mode.layout.open, { region: "main" as const, panel: "extension-lab.sourceFiles" }],
        },
      })),
      panels: [
        ...metadataWithLabMode.panels,
        {
          id: "extension-lab.sourceFiles",
          extensionId: "pstdio.extension-lab",
          title: "Source files",
          region: "main" as const,
          closable: false,
          eligibleLocations: { resourceKinds: ["extension-view"] },
          webview: {
            entry: {
              kind: "package-asset" as const,
              path: "./src/source-files.tsx",
              baseUrl: "file:///extension/extension.ts",
            },
            runtimeUrl: "/v1/extensions/runtime",
            moduleUrl: "/v1/extensions/installed/extension-lab/webviews/source-files/module.js",
          },
        },
        {
          id: "extension-lab.sourceEditor",
          extensionId: "pstdio.extension-lab",
          title: "Source files",
          region: "main" as const,
          closable: false,
          resourceKind: "lab-source",
          eligibleLocations: { resourceKinds: ["extension-view"] },
          webview: {
            entry: {
              kind: "package-asset" as const,
              path: "./src/views/source.tsx",
              baseUrl: "file:///extension/extension.ts",
            },
            runtimeUrl: "/v1/extensions/runtime",
            moduleUrl: "/v1/extensions/installed/extension-lab/webviews/source/module.js",
          },
        },
      ],
    };
    const workbench = createWorkbenchCore();
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(
      createExtensionsModule({ loadMetadata: mock(async () => resourceMetadata) }),
    );

    try {
      await flushMicrotasks();
      await flushMicrotasks();
      workbench.modes.setActiveMode("pstdio.extension-lab.lab");
      const locationId = workbench.layout.getLayout().activeLocationWidgetId;
      const sourceFiles = workbench.layout
        .getLayout()
        .regions.main.widgets.find((placement) => placement.contributionId.endsWith("sourceFiles"));
      expect(sourceFiles).toBeDefined();
      workbench.layout.activatePanel(sourceFiles!.widgetId);
      expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(sourceFiles!.widgetId);

      await workbench.resources.openResource(
        {
          kind: "lab-source",
          uri: "pstdio://extension-resource/lab-source/source-1",
          id: "source-1",
          label: "Source 1",
        },
        { replaceActive: true },
      );

      expect(workbench.modes.getActiveModeId()).toBe("pstdio.extension-lab.lab");
      expect(workbench.layout.getLayout().regions.main.widgets.map((placement) => placement.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labOverview",
        "dashboard-workbench.extension-view.extension-lab.sourceEditor",
      ]);
      expect(workbench.layout.getLayout().activeLocationWidgetId).toBe(locationId);
      expect(workbench.layout.getActivePanel("main")?.resource).toMatchObject({
        kind: "lab-source",
        id: "source-1",
      });
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});

describe("createExtensionsModule resource view registration", () => {
  test("registers and opens a resource kind declared only by a main extension panel", async () => {
    const resourceMetadata = {
      ...metadataWithTickets,
      modes: [],
      kanbanRenderers: [],
      treeRenderers: [],
      panels: [
        {
          id: "extension-lab.labArtifactReport",
          extensionId: "pstdio.extension-lab",
          title: "Artifact report",
          icon: "chart-no-axes-combined",
          region: "main" as const,
          closable: true,
          resourceKind: "glass-lab-artifact",
          webview: {
            entry: {
              kind: "package-asset" as const,
              path: "./src/views/lab-artifact.tsx",
              baseUrl: "file:///extension/extension.ts",
            },
            runtimeUrl: "/v1/extensions/runtime",
            moduleUrl: "/v1/extensions/installed/extension-lab/webviews/lab-artifact/module.js",
          },
        },
      ],
    };
    const loadMetadata = mock(async () => resourceMetadata);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "lab", label: "Lab", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      expect(workbench.resources.getKind("glass-lab-artifact")).toMatchObject({
        kind: "glass-lab-artifact",
        label: "Artifact report",
      });
      workbench.modes.setActiveMode("lab");

      await workbench.resources.openResource({
        kind: "glass-lab-artifact",
        uri: "pstdio://extension-resource/glass-lab-artifact/artifact-1",
        id: "artifact-1",
        label: "Artifact 1",
      });

      expect(workbench.getPrimaryResource()).toMatchObject({ kind: "glass-lab-artifact", id: "artifact-1" });
      expect(workbench.modes.getActiveModeId()).toBe("lab");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

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
});

describe("createExtensionsModule resource view menus", () => {
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
      expect(rightMenu.widgets[0]?.ownerResourceUri).toBe(ticketB.uri);
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
