import { commandRef, type ExtensionDefinition, l10n, packageAsset } from "@pstdio/sdk/extensions";

export const labModes = {
  lab: {
    id: "pstdio.extension-lab.lab",
    label: l10n("modes.lab.label", "Lab"),
    icon: "flask-conical",
    layout: {
      reset: true,
      open: [
        { target: "workbench.left", view: "labSidebar", pinned: true },
        { target: "workbench.main", view: "labOverview" },
      ],
    },
  },
  labFocus: {
    id: "pstdio.extension-lab.focus",
    label: l10n("modes.labFocus.label", "Lab focus"),
    icon: "panel-top",
    layout: {
      reset: ["workbench.main"],
      open: [{ target: "workbench.main", view: "labOverview" }],
    },
  },
} satisfies NonNullable<ExtensionDefinition["modes"]>;

export const createLabViews = (baseUrl: string) =>
  ({
    labSidebar: {
      title: l10n("views.labSidebar.title", "Lab"),
      webview: { entry: packageAsset("./src/views/lab-sidebar.tsx", baseUrl) },
    },
    labOverview: {
      title: l10n("views.labOverview.title", "Lab overview"),
      webview: {
        entry: packageAsset("./src/views/lab-overview.tsx", baseUrl),
        capabilities: [
          "commands.execute",
          "notification.action",
          "notification.show",
          "preferences.get",
          "preferences.set",
        ],
      },
    },
  }) satisfies NonNullable<ExtensionDefinition["views"]>;

export const createLabRoutes = (baseUrl: string) =>
  ({
    labPage: {
      path: "lab",
      label: l10n("routes.lab.label", "Lab"),
      webview: {
        entry: packageAsset("./src/views/main.tsx", baseUrl),
        capabilities: [
          "commands.execute",
          "notification.action",
          "notification.show",
          "preferences.get",
          "preferences.set",
        ],
      },
    },
    faultyPage: {
      path: "lab-faulty",
      label: l10n("routes.faulty.label", "Lab (faulty)"),
      webview: {
        entry: packageAsset("./src/views/faulty-main.tsx", baseUrl),
      },
    },
  }) satisfies NonNullable<ExtensionDefinition["routes"]>;

export const labTreeItems = {
  openLabMode: {
    target: "workbench.left.tree",
    group: "Lab",
    label: l10n("tree.openLabMode.label", "Lab mode"),
    icon: "flask-conical",
    action: {
      kind: "command",
      command: "workbench.action.switchMode",
      params: { modeId: "pstdio.extension-lab.lab" },
    },
  },
  labPage: {
    target: "workbench.left.tree",
    group: "Lab",
    label: l10n("routes.lab.label", "Lab"),
    icon: "flask-conical",
    action: { kind: "route", route: "lab" },
  },
  faultyPage: {
    target: "workbench.left.tree",
    group: "Lab",
    label: l10n("routes.faulty.label", "Lab (faulty)"),
    icon: "flask-conical-off",
    action: { kind: "route", route: "lab-faulty" },
  },
} satisfies NonNullable<ExtensionDefinition["treeItems"]>;

export const labDataRenderers = {
  glassLabArtifacts: {
    title: "Glass Lab artifacts",
    resourceKind: "glass-lab-artifact",
    queryCommand: commandRef("extension-lab.glass-lab-artifacts.query"),
    defaultSettings: {
      viewMode: "list",
      columnGrouping: "none",
      rowGrouping: "none",
      ordering: { attributeId: "trustSignal", direction: "desc" },
      displayProperties: ["role", "trustSignal", "status"],
    },
    emptyTitle: "No artifacts found",
    emptyDescription: "The sealed research facility has not cataloged any artifacts yet.",
  },
} satisfies NonNullable<ExtensionDefinition["dataRenderers"]>;

export const createLabSettingsPanels = (baseUrl: string) =>
  ({
    projectPanel: {
      target: "workbench.settings",
      scope: "project",
      title: l10n("settingsPanels.project.title", "Lab (project)"),
      webview: {
        entry: packageAsset("./src/views/settings-project.tsx", baseUrl),
        capabilities: ["extension.settings.all", "extension.settings.set"],
      },
    },
    globalPanel: {
      target: "workbench.settings",
      scope: "global",
      title: l10n("settingsPanels.global.title", "Lab (global)"),
      webview: {
        entry: packageAsset("./src/views/settings-global.tsx", baseUrl),
        capabilities: ["extension.settings.all", "extension.settings.set"],
      },
    },
  }) satisfies NonNullable<ExtensionDefinition["settingsPanels"]>;
