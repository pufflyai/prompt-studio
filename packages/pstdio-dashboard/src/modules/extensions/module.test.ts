import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse, WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore, type ResourceRef, workbenchTopHeaderTrailingMenuPath } from "pstdio-workbench/core";
import { listWorkbenchMenuItems } from "pstdio-workbench/react";
import { describeResourceRouteContract } from "pstdio-workbench/testing";
import i18n from "@/i18n";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import {
  getProjectSidebarContributionSections,
  getWorkspaceSidebarContributionSections,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { createExtensionsModule } from "./module";

const emptyAppearance = { themes: [], fileIconThemes: [], translations: [], diagnostics: [] };

const metadata = {
  extensions: [{ id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [
    { id: "extension-lab.say-hello", extensionId: "pstdio.extension-lab", title: "Say hello" },
    { id: "extension-lab.counter.bump", extensionId: "pstdio.extension-lab", title: "Bump lab counter" },
  ],
  diagnostics: [],
  menuContributions: [
    {
      id: "extension-lab.say-hello.menu.0",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.say-hello",
      slotId: "project.headerPrimary",
      target: "workbench.nav.actions",
      label: "Lab: Say hello",
      icon: "flask-conical",
      when: {
        resourceType: ["extension-route"],
        metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
      },
    },
    {
      id: "extension-lab.counter.bump.menu.0",
      extensionId: "pstdio.extension-lab",
      commandId: "extension-lab.counter.bump",
      slotId: "project.headerOverflow",
      target: "workbench.nav.overflow",
      label: "Bump lab counter",
      when: {
        resourceType: ["extension-route"],
        metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
      },
    },
  ],
  modes: [],
  navigation: [],
  routes: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      path: "lab",
      label: "Lab",
      webview: {
        entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.labPage/module.js",
      },
    },
  ],
  settingsPanels: [],
  treeItems: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      target: "workbench.left.tree",
      group: "Lab",
      label: "Lab",
      icon: "flask-conical",
      action: { kind: "route", route: "lab" },
    },
  ],
  views: [],
} satisfies DashboardExtensionMetadata;

const response = {
  commandId: "extension-lab.say-hello",
  extensionId: "pstdio.extension-lab",
  outcome: { ok: true, status: "success", value: { message: "hello" } },
} satisfies CommandExecuteResponse;

const metadataWithLabMode = {
  ...metadata,
  modes: [
    {
      id: "extension-lab.lab",
      extensionId: "pstdio.extension-lab",
      modeId: "pstdio.extension-lab.lab",
      label: "Lab",
      icon: "flask-conical",
      layout: {
        reset: true,
        open: [
          { target: "workbench.left", view: "extension-lab.labSidebar", pinned: true },
          { target: "workbench.main", view: "extension-lab.labOverview" },
        ],
      },
    },
  ],
  views: [
    {
      id: "extension-lab.labSidebar",
      extensionId: "pstdio.extension-lab",
      slotId: "workbench.left",
      target: "workbench.main.left",
      title: "Lab",
      webview: {
        entry: { kind: "package-asset", path: "./src/lab-sidebar.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.labSidebar/module.js",
      },
    },
    {
      id: "extension-lab.labOverview",
      extensionId: "pstdio.extension-lab",
      slotId: "workbench.main",
      target: "workbench.main",
      title: "Lab overview",
      webview: {
        entry: { kind: "package-asset", path: "./src/lab-overview.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.labOverview/module.js",
      },
    },
  ],
} satisfies DashboardExtensionMetadata;

const metadataWithTickets = {
  ...metadata,
  dataRenderers: [
    {
      id: "pstdio-core-tickets.tickets",
      extensionId: "pstdio.pstdio-core-tickets",
      title: "Tickets",
      resourceKind: "ticket",
      queryCommandId: "pstdio-core-tickets.query-tickets",
    },
  ],
  views: [
    {
      id: "pstdio-core-tickets.ticketEditor",
      extensionId: "pstdio.pstdio-core-tickets",
      slotId: "workbench.main",
      target: "workbench.main",
      title: "Ticket",
      resourceKind: "ticket",
      webview: {
        entry: {
          kind: "package-asset",
          path: "./src/views/ticket-editor.tsx",
          baseUrl: "file:///extension/extension.ts",
        },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/pstdio-core-tickets/webviews/ticket-editor/module.js",
      },
    },
  ],
} satisfies DashboardExtensionMetadata;

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("createExtensionsModule", () => {
  test("localizes extension menu and route labels from appearance translations", async () => {
    await i18n.changeLanguage("fr");
    const loadMetadata = mock(async () => ({
      ...metadata,
      commands: [
        {
          id: "extension-lab.say-hello",
          extensionId: "pstdio.extension-lab",
          title: { $l10n: "commands.sayHello.title", default: "Say hello" },
        },
      ],
      menuContributions: [
        {
          ...metadata.menuContributions[0]!,
          label: { $l10n: "commands.sayHello.menu", default: "Lab: Say hello" },
        },
      ],
      routes: [
        {
          ...metadata.routes[0]!,
          label: { $l10n: "routes.lab.label", default: "Lab" },
        },
      ],
      treeItems: [
        {
          ...metadata.treeItems[0]!,
          label: { $l10n: "routes.lab.label", default: "Lab" },
        },
      ],
    }));
    const loadAppearance = mock(async () => ({
      themes: [],
      fileIconThemes: [],
      translations: [
        {
          extensionId: "pstdio.extension-lab",
          defaultLocale: "en",
          bundles: {
            en: {
              "commands.sayHello.menu": "Lab: Say hello",
              "commands.sayHello.title": "Say hello",
              "routes.lab.label": "Lab",
            },
            fr: {
              "commands.sayHello.menu": "Lab: Dire bonjour",
              "commands.sayHello.title": "Dire bonjour",
              "routes.lab.label": "Laboratoire",
            },
          },
        },
      ],
      diagnostics: [],
    }));
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

    try {
      await flushMicrotasks();

      const labResource = workbench.resources.listResources("").find((entry) => entry.resource.id === "lab")?.resource;
      expect(labResource?.label).toBe("Laboratoire");

      await workbench.resources.openResource(labResource!);

      const headerActions = listWorkbenchMenuItems(workbench, workbenchTopHeaderTrailingMenuPath);
      expect(headerActions.map((item) => item.label)).toEqual(["Lab: Dire bonjour"]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
      await i18n.changeLanguage("en");
    }
  });

  test("mounts extension-lab routes and route-scoped header actions", async () => {
    const loadMetadata = mock(async () => metadata);
    const executeCommand = mock(async () => response);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, executeCommand }));

    try {
      await flushMicrotasks();

      const labResource = workbench.resources.listResources("").find((entry) => entry.resource.id === "lab")?.resource;

      expect(labResource?.kind).toBe("extension-route");
      expect(labResource?.uri).toBe("dashboard-workbench://project/project-1/extensions/lab");
      expect(labResource?.metadata?.extensionId).toBe("pstdio.extension-lab");
      expect(labResource?.metadata?.routePath).toBe("lab");

      await workbench.resources.openResource(labResource!);

      const headerActions = listWorkbenchMenuItems(workbench, workbenchTopHeaderTrailingMenuPath);
      expect(headerActions.map((item) => item.label)).toEqual(["Lab: Say hello", "Bump lab counter"]);

      await workbench.commands.executeCommand(headerActions[0]!.commandId);

      expect(executeCommand).toHaveBeenCalledWith(
        "project-1",
        "extension-lab.say-hello",
        expect.objectContaining({
          projectId: "project-1",
          resource: expect.objectContaining({
            type: "extension-route",
            id: "lab",
            extensionId: "pstdio.extension-lab",
          }),
          slot: expect.objectContaining({
            id: "project.headerPrimary",
            kind: "menu",
          }),
        }),
      );
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("registers extension-lab modes and mounts their extension views", async () => {
    const loadMetadata = mock(async () => metadataWithLabMode);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      expect(workbench.modes.getMode("pstdio.extension-lab.lab")).toMatchObject({ label: "Lab" });

      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      expect(workbench.layout.getLayout().areas.left.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labSidebar",
      ]);
      expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      ]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("reopens a mode-layout extension view in the primary area on history replay", async () => {
    const loadMetadata = mock(async () => metadataWithLabMode);
    const loadAppearance = mock(async () => emptyAppearance);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

    try {
      await flushMicrotasks();
      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      const mainResource = workbench.layout.getLayout().areas.main.widgets[0]?.resource;
      expect(mainResource?.kind).toBe("extension-view");

      // Navigate the primary area away, then replay the extension-view entry the way history
      // goBack/goForward does (openResource with replaceActive). Before the view opener existed,
      // this rejected with "No opener registered for resource kind: extension-view".
      workbench.layout.openWidget(dashboardWidgetIds.extensionRoute, { replaceActive: true });
      await workbench.resources.openResource(mainResource!, { replaceActive: true });

      expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      ]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("contributes extension tree items only to the project sidebar", async () => {
    const loadMetadata = mock(async () => metadata);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const projectNodeIds = getProjectSidebarContributionSections(workbench)
        .flatMap((section) => section.nodes)
        .map((node) => node.id);
      const workspaceNodeIds = getWorkspaceSidebarContributionSections(workbench)
        .flatMap((section) => section.nodes)
        .map((node) => node.id);

      expect(projectNodeIds).toContain("dashboard-workbench://project/project-1/extensions/lab");
      expect(workspaceNodeIds).not.toContain("dashboard-workbench://project/project-1/extensions/lab");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("navigates back from a ticket editor to the tickets board", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const ticketsBoard = getProjectSidebarContributionSections(workbench)
        .flatMap((section) => section.nodes)
        .find((node) => node.resource?.id === "pstdio-core-tickets.tickets")?.resource;
      const ticket = {
        kind: "ticket",
        uri: "dashboard-workbench://ticket/PS-10",
        id: "PS-10",
        label: "PS-10 Ticket",
        metadata: { projectId: "project-1" },
      } satisfies ResourceRef;

      await workbench.resources.openResource(ticketsBoard!);
      await workbench.resources.openResource(ticket, { replaceActive: true });

      const back = workbench.history.goBack();
      await flushMicrotasks();

      expect(back?.resource?.uri).toBe(ticketsBoard?.uri);
      expect(workbench.layout.getLayout().activeWidgetId).toBe("pstdio-core-tickets.tickets");
      expect(workbench.layout.getLayout().activeResourceUri).toBe(ticketsBoard?.uri);
      expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
        "pstdio-core-tickets.tickets",
      ]);

      const forward = workbench.history.goForward();
      await flushMicrotasks();

      expect(forward?.resource?.uri).toBe(ticket.uri);
      expect(workbench.layout.getLayout().activeWidgetId).toBe(
        "dashboard-workbench.extension-view.pstdio-core-tickets.ticketEditor",
      );
      expect(workbench.layout.getLayout().activeResourceUri).toBe(ticket.uri);
      expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.pstdio-core-tickets.ticketEditor",
      ]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});

// The tickets board (data-renderer route) and the ticket editor (extension resource-view route)
// both run in project mode. The ticket editor places the DOMAIN ticket resource with the view
// derived at render time, so the contract guards that Back/Forward stay resource-first.
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
    metadata: { projectId: "project-1", dataRendererId: "pstdio-core-tickets.tickets" },
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
  expectedMode: "project",
});
