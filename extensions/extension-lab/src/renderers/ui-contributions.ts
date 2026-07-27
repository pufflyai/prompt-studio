import { commandRef, type ExtensionDefinition, l10n, packageAsset } from "@pstdio/sdk/extensions";

export const labModes = {
  lab: {
    id: "pstdio.extension-lab.lab",
    label: l10n("modes.lab.label", "Lab coding"),
    icon: "flask-conical",
    layout: {
      panels: ["main", "secondary", "side"],
      open: [
        { region: "main", panel: "labOverview" },
        { region: "secondary", panel: "labConsole" },
      ],
    },
  },
  labDesign: {
    id: "pstdio.extension-lab.design",
    label: l10n("modes.labDesign.label", "Lab design"),
    icon: "palette",
    layout: {
      panels: ["main", "side"],
      open: [{ region: "main", panel: "labCanvas" }],
    },
  },
  labReview: {
    id: "pstdio.extension-lab.review",
    label: l10n("modes.labReview.label", "Lab review"),
    icon: "scan-search",
    layout: {
      panels: ["main", "secondary", "side"],
      open: [
        { region: "main", panel: "labReview" },
        { region: "secondary", panel: "labChecks" },
      ],
    },
  },
  labFocus: {
    id: "pstdio.extension-lab.focus",
    label: l10n("modes.labFocus.label", "Lab focus"),
    icon: "panel-top",
    layout: {
      panels: ["main"],
      open: [{ region: "main", panel: "labFocus" }],
    },
  },
} satisfies NonNullable<ExtensionDefinition["modes"]>;

export const createLabPanels = (baseUrl: string) =>
  ({
    labOverview: {
      title: l10n("panels.labOverview.title", "Lab overview"),
      region: "main",
      closable: false,
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
      panelMenus: {
        tools: {
          title: l10n("panels.labTools.title", "Coding tools"),
          side: "left",
          webview: { entry: packageAsset("./src/views/lab-tools.tsx", baseUrl) },
        },
        inspector: {
          title: l10n("panels.labInspector.title", "Inspector"),
          side: "right",
          webview: { entry: packageAsset("./src/views/lab-inspector.tsx", baseUrl) },
        },
      },
    },
    labConsole: {
      title: l10n("panels.labConsole.title", "Experiment console"),
      region: "secondary",
      closable: true,
      webview: { entry: packageAsset("./src/views/lab-console.tsx", baseUrl) },
    },
    labCanvas: {
      title: l10n("panels.labCanvas.title", "Prototype canvas"),
      region: "main",
      closable: false,
      webview: { entry: packageAsset("./src/views/lab-canvas.tsx", baseUrl) },
      panelMenus: {
        palette: {
          title: l10n("panels.labPalette.title", "Design palette"),
          side: "left",
          webview: { entry: packageAsset("./src/views/lab-palette.tsx", baseUrl) },
        },
        inspector: {
          title: l10n("panels.labInspector.title", "Inspector"),
          side: "right",
          webview: { entry: packageAsset("./src/views/lab-inspector.tsx", baseUrl) },
        },
      },
    },
    labReview: {
      title: l10n("panels.labReview.title", "Change review"),
      region: "main",
      closable: false,
      webview: { entry: packageAsset("./src/views/lab-review.tsx", baseUrl) },
      panelMenus: {
        inspector: {
          title: l10n("panels.labInspector.title", "Inspector"),
          side: "right",
          webview: { entry: packageAsset("./src/views/lab-inspector.tsx", baseUrl) },
        },
      },
    },
    labChecks: {
      title: l10n("panels.labChecks.title", "Review checks"),
      region: "secondary",
      closable: true,
      webview: { entry: packageAsset("./src/views/lab-checks.tsx", baseUrl) },
    },
    labFocus: {
      title: l10n("panels.labFocus.title", "Focus"),
      region: "main",
      closable: false,
      webview: { entry: packageAsset("./src/views/lab-focus.tsx", baseUrl) },
    },
  }) satisfies NonNullable<ExtensionDefinition["panels"]>;

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

export const labKanbanRenderers = {
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
} satisfies NonNullable<ExtensionDefinition["kanbanRenderers"]>;

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
