import type { CommandExecuteResponse, WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";

const labExtensionId = "pstdio.extension-lab";
const issuesExtensionId = "acme.issue-tracker";
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
  pages: [
    {
      id: `${labExtensionId}.page.lab`,
      localId: "lab",
      extensionId: labExtensionId,
      title: "Lab",
      icon: "flask-conical",
      path: "lab",
      slots: [
        {
          id: "main",
          region: "main" as const,
          view: ref(labExtensionId, "view", "lab-page"),
          closable: false,
        },
      ],
    },
  ],
  views: [
    {
      id: `${labExtensionId}.view.lab-page`,
      localId: "lab-page",
      extensionId: labExtensionId,
      title: "Lab",
      body: { kind: "webview", webview: webview("./src/main.tsx", "lab-page") },
    },
  ],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  resourceHierarchyProviders: [],
  navigationItems: [
    {
      id: `${labExtensionId}.navigation-item.lab`,
      extensionId: labExtensionId,
      slot: ref("pstdio", "navigation-item", "project.navigation"),
      group: "Lab",
      label: "Lab",
      icon: "flask-conical",
      action: {
        kind: "command" as const,
        target: {
          command: ref("pstdio", "command", "workbench.action.switchMode"),
          params: { modeId: "lab" },
        },
      },
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
      id: `${labExtensionId}.view.workflow`,
      localId: "workflow",
      extensionId: labExtensionId,
      title: "Workflow",
      body: { kind: "webview" as const, webview: webview("./src/workflow.tsx", "workflow") },
    },
    {
      id: `${labExtensionId}.view.overview`,
      localId: "overview",
      extensionId: labExtensionId,
      title: "Lab overview",
      body: { kind: "webview" as const, webview: webview("./src/overview.tsx", "overview") },
    },
  ],
  placements: [
    {
      id: `${labExtensionId}.placement.workflow`,
      localId: "workflow",
      extensionId: labExtensionId,
      mode: ref(labExtensionId, "mode", "lab"),
      item: { kind: "view" as const, view: ref(labExtensionId, "view", "workflow") },
      region: "sidenav" as const,
      required: true,
    },
    {
      id: `${labExtensionId}.placement.overview`,
      localId: "overview",
      extensionId: labExtensionId,
      mode: ref(labExtensionId, "mode", "lab"),
      item: { kind: "view" as const, view: ref(labExtensionId, "view", "overview") },
      region: "main" as const,
      required: true,
    },
  ],
} satisfies DashboardExtensionMetadata;

export const metadataWithResourceExtension = {
  ...metadata,
  extensions: [
    ...metadata.extensions,
    { id: issuesExtensionId, name: "issue-tracker", displayName: "Issue Tracker", sourcePath: "" },
  ],
  views: [
    ...metadata.views,
    {
      id: `${issuesExtensionId}.view.issues`,
      localId: "issues",
      extensionId: issuesExtensionId,
      title: "Issues",
      body: { kind: "kanban" as const, queryHandlerId: `${issuesExtensionId}.view.issues.query` },
    },
    {
      id: `${issuesExtensionId}.view.issueFiles`,
      localId: "issueFiles",
      extensionId: issuesExtensionId,
      title: "Files",
      body: {
        kind: "tree" as const,
        bodyHandlerId: `${issuesExtensionId}.view.issueFiles.body`,
        defaultExpandedSectionIds: ["files"],
      },
    },
  ],
  pages: [
    ...metadata.pages,
    {
      id: `${issuesExtensionId}.page.issues`,
      localId: "issues",
      extensionId: issuesExtensionId,
      title: "Issues",
      path: "issues",
      slots: [
        {
          id: "board",
          region: "main" as const,
          view: ref(issuesExtensionId, "view", "issues"),
          closable: false,
        },
        { id: "detail", region: "main" as const, cardinality: "one" as const },
      ],
      bindings: [
        {
          resourceKind: ref(issuesExtensionId, "resource-kind", "issue"),
          view: ref(issuesExtensionId, "view", "issueFiles"),
          slot: "detail",
        },
      ],
    },
  ],
  resourceKinds: [
    {
      id: "issue",
      localId: "issue",
      extensionId: issuesExtensionId,
      label: "Issue",
      icon: "component",
    },
  ],
} satisfies DashboardExtensionMetadata;

export const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
