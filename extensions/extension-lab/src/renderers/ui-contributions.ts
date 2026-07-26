import { commandRef, type ExtensionDefinition, l10n, packageAsset } from "@pstdio/sdk/extensions";

export const labModes = {
  lab: {
    id: "pstdio.extension-lab.lab",
    label: l10n("modes.lab.label", "Lab coding"),
    icon: "flask-conical",
    layout: {
      panels: ["main", "secondary", "side"],
      open: [
        { target: "workbench.main", view: "labOverview" },
        { target: "workbench.main.left", view: "labTools", pinned: true },
        { target: "workbench.main.right", view: "labInspector", pinned: true },
        { target: "workbench.secondary", view: "labConsole" },
      ],
    },
  },
  labDesign: {
    id: "pstdio.extension-lab.design",
    label: l10n("modes.labDesign.label", "Lab design"),
    icon: "palette",
    layout: {
      panels: ["main", "side"],
      open: [
        { target: "workbench.main", view: "labCanvas" },
        { target: "workbench.main.left", view: "labPalette", pinned: true },
        { target: "workbench.main.right", view: "labInspector", pinned: true },
      ],
    },
  },
  labReview: {
    id: "pstdio.extension-lab.review",
    label: l10n("modes.labReview.label", "Lab review"),
    icon: "scan-search",
    layout: {
      panels: ["main", "secondary", "side"],
      open: [
        { target: "workbench.main", view: "labReview" },
        { target: "workbench.main.right", view: "labInspector", pinned: true },
        { target: "workbench.secondary", view: "labChecks" },
      ],
    },
  },
  labFocus: {
    id: "pstdio.extension-lab.focus",
    label: l10n("modes.labFocus.label", "Lab focus"),
    icon: "panel-top",
    layout: {
      panels: ["main"],
      open: [{ target: "workbench.main", view: "labFocus" }],
    },
  },
} satisfies NonNullable<ExtensionDefinition["modes"]>;

export const createLabViews = (baseUrl: string) =>
  ({
    labOverview: {
      title: l10n("views.labOverview.title", "Lab overview"),
      role: "location",
      target: "workbench.main",
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
    labTools: {
      title: l10n("views.labTools.title", "Coding tools"),
      role: "panel-menu",
      target: "workbench.main.left",
      panelMenuOwner: { level: "panel" },
      webview: { entry: packageAsset("./src/views/lab-tools.tsx", baseUrl) },
    },
    labInspector: {
      title: l10n("views.labInspector.title", "Inspector"),
      role: "panel-menu",
      target: "workbench.main.right",
      panelMenuOwner: { level: "panel" },
      webview: { entry: packageAsset("./src/views/lab-inspector.tsx", baseUrl) },
    },
    labConsole: {
      title: l10n("views.labConsole.title", "Experiment console"),
      role: "sub-panel",
      target: "workbench.secondary",
      webview: { entry: packageAsset("./src/views/lab-console.tsx", baseUrl) },
    },
    labPalette: {
      title: l10n("views.labPalette.title", "Design palette"),
      role: "panel-menu",
      target: "workbench.main.left",
      panelMenuOwner: { level: "panel" },
      webview: { entry: packageAsset("./src/views/lab-palette.tsx", baseUrl) },
    },
    labCanvas: {
      title: l10n("views.labCanvas.title", "Prototype canvas"),
      role: "location",
      target: "workbench.main",
      webview: { entry: packageAsset("./src/views/lab-canvas.tsx", baseUrl) },
    },
    labReview: {
      title: l10n("views.labReview.title", "Change review"),
      role: "location",
      target: "workbench.main",
      webview: { entry: packageAsset("./src/views/lab-review.tsx", baseUrl) },
    },
    labChecks: {
      title: l10n("views.labChecks.title", "Review checks"),
      role: "sub-panel",
      target: "workbench.secondary",
      webview: { entry: packageAsset("./src/views/lab-checks.tsx", baseUrl) },
    },
    labFocus: {
      title: l10n("views.labFocus.title", "Focus"),
      role: "location",
      target: "workbench.main",
      webview: { entry: packageAsset("./src/views/lab-focus.tsx", baseUrl) },
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
    label: l10n("tree.openLabMode.label", "Lab coding mode"),
    icon: "flask-conical",
    action: {
      kind: "command",
      command: "workbench.action.switchMode",
      params: { modeId: "pstdio.extension-lab.lab" },
    },
  },
  openLabDesignMode: {
    target: "workbench.left.tree",
    group: "Lab",
    label: l10n("tree.openLabDesignMode.label", "Lab design mode"),
    icon: "palette",
    action: {
      kind: "command",
      command: "workbench.action.switchMode",
      params: { modeId: "pstdio.extension-lab.design" },
    },
  },
  openLabReviewMode: {
    target: "workbench.left.tree",
    group: "Lab",
    label: l10n("tree.openLabReviewMode.label", "Lab review mode"),
    icon: "scan-search",
    action: {
      kind: "command",
      command: "workbench.action.switchMode",
      params: { modeId: "pstdio.extension-lab.review" },
    },
  },
  openLabFocusMode: {
    target: "workbench.left.tree",
    group: "Lab",
    label: l10n("tree.openLabFocusMode.label", "Lab focus mode"),
    icon: "panel-top",
    action: {
      kind: "command",
      command: "workbench.action.switchMode",
      params: { modeId: "pstdio.extension-lab.focus" },
    },
  },
  labPage: {
    target: "workbench.left.tree",
    group: "Lab",
    label: l10n("routes.lab.label", "Lab"),
    icon: "flask-conical",
    action: { kind: "route", route: "lab" },
  },
  openTerminal: {
    target: "workbench.left.tree",
    group: "Lab",
    label: l10n("tree.openTerminal.label", "Open terminal"),
    icon: "square-terminal",
    action: { kind: "command", command: "workbench.terminal.open" },
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
