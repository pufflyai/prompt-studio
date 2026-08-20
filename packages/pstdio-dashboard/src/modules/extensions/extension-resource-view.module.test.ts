import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { subscribeToExtensionCommandFeed } from "@/shared/extensions/extension-webview-broadcast";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createWorkspacesModule } from "../workspaces/module";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadataWithTickets, response } from "./module-test-fixtures";

describe("createExtensionsModule resource inspectors", () => {
  test("opens side-only resource kinds as inspectors without leaving the active mode", async () => {
    const inspectorMetadata = {
      ...metadataWithTickets,
      modes: [],
      kanbanRenderers: [],
      treeRenderers: [],
      resourceKinds: [
        {
          id: "glass-lab-artifact",
          extensionId: "pstdio.extension-lab",
          surface: "attached" as const,
          slots: { detail: { cardinality: "one" as const, external: false } },
        },
      ],
      resourcePanels: [
        {
          id: "extension-lab.labArtifact.detail",
          extensionId: "pstdio.extension-lab",
          resourceKind: "glass-lab-artifact",
          panel: "extension-lab.labArtifactDetail",
          slot: "detail",
        },
      ],
      panels: [
        {
          id: "extension-lab.labArtifactDetail",
          extensionId: "pstdio.extension-lab",
          title: "Artifact",
          icon: "package-search",
          supportedRegions: ["side" as const],
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
  test("opens ticket detail with its attached Properties Panel Menu", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const loadAppearance = mock(async () => emptyAppearance);
    const executeCommand = mock(async () => response);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.modes.setActiveMode("project");
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

      // A ticket is a resource: opening one keeps the workbench the user is in, so the
      // project's own chrome stays put instead of being replaced by a ticket mode.
      expect(workbench.modes.getActiveModeId()).toBe("project");
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
      "pstdio-core-tickets.ticketFiles.body": {
        commandId: "pstdio-core-tickets.ticketFiles.body",
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
                    command: "pstdio-core-tickets.select-ticket-file",
                    params: { ticketId: "PS-10", fileId: "file-1" },
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
      expect(breadcrumbs?.map((item) => item.title)).toEqual(["PS-9 Root", "PS-10 Parent", "PS-11 Child"]);
      expect(breadcrumbs?.[1]?.resource).toMatchObject({
        kind: "ticket",
        id: "PS-10",
        label: "PS-10 Parent",
        icon: "component",
      });
      expect(breadcrumbs?.[1]?.icon).toBe("component");
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
        "PS-10 Parent",
        "PS-11 Child",
        "PS-11_A1",
      ]);

      workbench.history.goBack();
      await flushMicrotasks();
      expect(workbench.getPrimaryResource()?.id).toBe(child.id);
      expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["PS-10 Parent", "PS-11 Child"]);

      workbench.history.goBack();
      await flushMicrotasks();
      expect(workbench.getPrimaryResource()?.id).toBe(parent.id);
    } finally {
      disposable.dispose();
    }
  });
});
