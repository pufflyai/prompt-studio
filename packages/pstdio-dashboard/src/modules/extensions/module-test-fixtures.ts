import type { CommandExecuteResponse, WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";

const labExtensionId = "pstdio.extension-lab";
const ticketsExtensionId = "pstdio.pstdio-core-tickets";
const ref = <Kind extends string>(extensionId: string, kind: Kind, id: string) => ({ extensionId, kind, id });
const webview = (path: string, id: string) => ({
  entry: { kind: "package-asset" as const, path, baseUrl: "file:///extension/extension.ts" },
  runtimeUrl: "/v1/extensions/runtime",
  moduleUrl: `/v1/extensions/installed/extension-lab/webviews/${id}/module.js`,
});

export const emptyAppearance = { themes: [], fileIconThemes: [], translations: [], diagnostics: [] };

export const metadata = {
  extensions: [{ id: labExtensionId, name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [
    { id: `${labExtensionId}.command.say-hello`, extensionId: labExtensionId, title: "Say hello" },
    { id: `${labExtensionId}.command.counter.bump`, extensionId: labExtensionId, title: "Bump lab counter" },
  ],
  diagnostics: [],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [],
  views: [
    {
      id: `${labExtensionId}.view.labPage`,
      localId: "labPage",
      extensionId: labExtensionId,
      path: "lab",
      title: "Lab",
      body: { kind: "webview", webview: webview("./src/main.tsx", "labPage") },
    },
  ],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  resourceViews: [],
  resourceHierarchyProviders: [],
  navigationItems: [
    {
      id: `${labExtensionId}.navigation-item.labPage`,
      extensionId: labExtensionId,
      slot: ref("pstdio", "navigation-item", "project.navigation"),
      group: "Lab",
      label: "Lab",
      icon: "flask-conical",
      action: { kind: "view", view: ref(labExtensionId, "view", "labPage") },
    },
  ],
  statusBarItems: [],
  statuses: [],
  activityItems: [],
  settingsSections: [],
  settingsPanels: [],
  commandPaletteResources: [],
  keybindings: [],
  settingsDefinitions: [],
} satisfies DashboardExtensionMetadata;

export const response = {
  commandId: `${labExtensionId}.command.say-hello`,
  extensionId: labExtensionId,
  outcome: { ok: true, status: "success", value: { message: "hello" } },
} satisfies CommandExecuteResponse;

export const metadataWithLabMode = {
  ...metadata,
  modes: [
    {
      id: `${labExtensionId}.mode.lab`,
      localId: "lab",
      extensionId: labExtensionId,
      label: "Lab",
      icon: "flask-conical",
    },
  ],
  views: [
    ...metadata.views,
    {
      id: `${labExtensionId}.view.labSidenav`,
      localId: "labSidenav",
      extensionId: labExtensionId,
      title: "Lab",
      body: { kind: "webview" as const, webview: webview("./src/lab-sidenav.tsx", "labSidenav") },
    },
    {
      id: `${labExtensionId}.view.labOverview`,
      localId: "labOverview",
      extensionId: labExtensionId,
      title: "Lab overview",
      body: { kind: "webview" as const, webview: webview("./src/lab-overview.tsx", "labOverview") },
    },
  ],
  placements: [
    {
      id: `${labExtensionId}.placement.lab-sidenav`,
      localId: "lab-sidenav",
      extensionId: labExtensionId,
      mode: ref(labExtensionId, "mode", "lab"),
      item: { kind: "view" as const, view: ref(labExtensionId, "view", "labSidenav") },
      region: "sidenav" as const,
      required: true,
    },
    {
      id: `${labExtensionId}.placement.lab-overview`,
      localId: "lab-overview",
      extensionId: labExtensionId,
      mode: ref(labExtensionId, "mode", "lab"),
      item: { kind: "view" as const, view: ref(labExtensionId, "view", "labOverview") },
      region: "main" as const,
      required: true,
    },
  ],
} satisfies DashboardExtensionMetadata;

export const metadataWithTickets = {
  ...metadata,
  extensions: [
    ...metadata.extensions,
    { id: ticketsExtensionId, name: "pstdio-core-tickets", displayName: "Tickets", sourcePath: "" },
  ],
  views: [
    ...metadata.views,
    {
      id: `${ticketsExtensionId}.view.tickets`,
      localId: "tickets",
      extensionId: ticketsExtensionId,
      title: "Tickets",
      body: { kind: "kanban" as const, queryHandlerId: `${ticketsExtensionId}.view.tickets.query` },
    },
    {
      id: `${ticketsExtensionId}.view.ticketFiles`,
      localId: "ticketFiles",
      extensionId: ticketsExtensionId,
      title: "Files",
      body: {
        kind: "tree" as const,
        bodyHandlerId: `${ticketsExtensionId}.view.ticketFiles.body`,
        defaultExpandedSectionIds: ["files"],
      },
    },
  ],
  resourceKinds: [
    {
      id: "ticket",
      localId: "ticket",
      extensionId: ticketsExtensionId,
      surface: "primary" as const,
      label: "Ticket",
      icon: "component",
      slots: [
        { id: "primary", cardinality: "one" as const, access: "owner" as const },
        { id: "files", cardinality: "one" as const, access: "owner" as const },
      ],
    },
  ],
  resourceViews: [
    {
      id: `${ticketsExtensionId}.resource-view.ticket-files`,
      extensionId: ticketsExtensionId,
      resourceKind: ref(ticketsExtensionId, "resource-kind", "ticket"),
      slot: { resourceKind: ref(ticketsExtensionId, "resource-kind", "ticket"), id: "files" },
      view: ref(ticketsExtensionId, "view", "ticketFiles"),
    },
  ],
} satisfies DashboardExtensionMetadata;

export const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
