import type { CommandExecuteResponse, WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";

export const emptyAppearance = { themes: [], fileIconThemes: [], translations: [], diagnostics: [] };

export const metadata = {
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
  panels: [],
} satisfies DashboardExtensionMetadata;

export const response = {
  commandId: "extension-lab.say-hello",
  extensionId: "pstdio.extension-lab",
  outcome: { ok: true, status: "success", value: { message: "hello" } },
} satisfies CommandExecuteResponse;

export const metadataWithLabMode = {
  ...metadata,
  modes: [
    {
      id: "extension-lab.lab",
      extensionId: "pstdio.extension-lab",
      modeId: "pstdio.extension-lab.lab",
      label: "Lab",
      icon: "flask-conical",
      layout: {
        panels: ["main", "secondary", "side"],
        open: [
          { region: "sidenav", panel: "extension-lab.labSidenav", pinned: true },
          { region: "main", panel: "extension-lab.labOverview" },
        ],
      },
    },
  ],
  panels: [
    {
      id: "extension-lab.labSidenav",
      extensionId: "pstdio.extension-lab",
      region: "sidenav",
      closable: false,
      title: "Lab",
      webview: {
        entry: { kind: "package-asset", path: "./src/lab-sidenav.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.labSidenav/module.js",
      },
    },
    {
      id: "extension-lab.labOverview",
      extensionId: "pstdio.extension-lab",
      region: "main",
      closable: false,
      title: "Lab overview",
      webview: {
        entry: { kind: "package-asset", path: "./src/lab-overview.tsx", baseUrl: "file:///extension/extension.ts" },
        runtimeUrl: "/v1/extensions/runtime",
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.labOverview/module.js",
      },
    },
  ],
} satisfies DashboardExtensionMetadata;

export const metadataWithTickets = {
  ...metadata,
  commands: [
    ...metadata.commands,
    {
      id: "pstdio-core-tickets.ticket-files.tree.body",
      extensionId: "pstdio.pstdio-core-tickets",
      title: "List ticket files",
    },
  ],
  kanbanRenderers: [
    {
      id: "pstdio-core-tickets.tickets",
      extensionId: "pstdio.pstdio-core-tickets",
      title: "Tickets",
      resourceKind: "ticket",
      queryHandlerId: "pstdio-core-tickets.tickets.query",
    },
  ],
  modes: [
    {
      id: "pstdio-core-tickets.ticket",
      extensionId: "pstdio.pstdio-core-tickets",
      modeId: "pstdio-core-tickets.ticket",
      label: "Ticket",
      icon: "FileText",
      resourceKind: "ticket",
      layout: {
        panels: ["main", "secondary", "side"],
        open: [{ region: "sidenav", panel: "pstdio-core-tickets.ticketFiles", pinned: true }],
      },
    },
  ],
  panels: [
    {
      id: "pstdio-core-tickets.ticketEditor",
      extensionId: "pstdio.pstdio-core-tickets",
      region: "main",
      closable: false,
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
      panelMenus: [
        {
          id: "pstdio-core-tickets.ticketProperties",
          extensionId: "pstdio.pstdio-core-tickets",
          ownerPanelId: "pstdio-core-tickets.ticketEditor",
          title: "Properties",
          side: "right",
          webview: {
            entry: {
              kind: "package-asset",
              path: "./src/views/ticket-properties.tsx",
              baseUrl: "file:///extension/extension.ts",
            },
            runtimeUrl: "/v1/extensions/runtime",
            moduleUrl: "/v1/extensions/installed/pstdio-core-tickets/webviews/ticket-properties/module.js",
          },
        },
      ],
    },
    {
      id: "pstdio-core-tickets.ticketFiles",
      extensionId: "pstdio.pstdio-core-tickets",
      title: "Files",
      region: "sidenav",
      closable: false,
      resourceKind: "ticket",
      treeRendererId: "pstdio-core-tickets.ticketFiles",
    },
  ],
  treeRenderers: [
    {
      id: "pstdio-core-tickets.ticketFiles",
      extensionId: "pstdio.pstdio-core-tickets",
      title: "Files",
      icon: "Files",
      bodyHandlerId: "pstdio-core-tickets.ticketFiles.body",
      defaultExpandedSectionIds: ["files"],
    },
  ],
} satisfies DashboardExtensionMetadata;

export const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
