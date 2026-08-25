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
        viewId: "extension-lab.labPage",
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
        viewId: "extension-lab.labPage",
      },
    },
  ],
  modes: [],
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
      action: { kind: "view", viewId: "extension-lab.labPage" },
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
      panelRegions: ["main", "secondary", "side"],
      modePanels: {
        "extension-lab.labSidenav": { region: "sidenav", pinned: true, required: true },
        "extension-lab.labOverview": { region: "main", required: true },
      },
    },
  ],
  panels: [
    {
      id: "extension-lab.labSidenav",
      extensionId: "pstdio.extension-lab",
      show: { region: "sidenav" },
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
      show: { region: "main" },
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
  treeItems: [
    ...metadata.treeItems,
    {
      id: "pstdio-core-tickets.tickets",
      extensionId: "pstdio.pstdio-core-tickets",
      target: "workbench.left.tree",
      label: "Tickets",
      icon: "square-kanban",
      action: { kind: "view", viewId: "pstdio-core-tickets.tickets" },
    },
  ],
  modes: [],
  resourceKinds: [
    {
      id: "ticket",
      extensionId: "pstdio.pstdio-core-tickets",
      surface: "primary",
      label: "Ticket",
      icon: "component",
      slots: {
        primary: { cardinality: "one", external: false },
        files: { cardinality: "one", external: false },
        properties: { cardinality: "many", external: true },
      },
    },
  ],
  resourcePanels: [
    {
      id: "pstdio-core-tickets.ticket.primary",
      extensionId: "pstdio.pstdio-core-tickets",
      resourceKind: "ticket",
      panel: "pstdio-core-tickets.ticketEditor",
      slot: "primary",
    },
    {
      id: "pstdio-core-tickets.ticket.files",
      extensionId: "pstdio.pstdio-core-tickets",
      resourceKind: "ticket",
      panel: "pstdio-core-tickets.ticketFiles",
      slot: "files",
    },
  ],
  panels: [
    {
      id: "pstdio-core-tickets.tickets",
      extensionId: "pstdio.pstdio-core-tickets",
      show: { region: "main" },
      title: "Tickets",
      renderer: { kind: "kanban", id: "pstdio-core-tickets.tickets" },
    },
    {
      id: "pstdio-core-tickets.ticketEditor",
      extensionId: "pstdio.pstdio-core-tickets",
      show: { region: "main" },
      title: "Ticket",
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
      show: { region: "sidenav" },
      renderer: { kind: "tree", id: "pstdio-core-tickets.ticketFiles" },
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
