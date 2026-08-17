import { commandRef, type ExtensionDefinition, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { labCommands } from "../commands";

const runLabCommand =
  (command: { run: (ctx: unknown) => unknown }, params: Record<string, unknown>) => (ctx: unknown) =>
    command.run({ ...(ctx as Record<string, unknown>), params, resource: params.resource });

export const labModes = {
  lab: {
    id: "pstdio.extension-lab.lab",
    label: l10n("modes.lab.label", "Lab"),
    icon: "flask-conical",
    layout: {
      // No "secondary": the Lab has no use for it, and omitting it removes the
      // secondary panel chrome — including the Terminal entry in its "+" menu.
      panels: ["main", "side"],
      open: [
        { region: "status", panel: "labStatusBar", pinned: true },
        { region: "main", panel: "labOverview" },
        { region: "main", panel: "labCams" },
        { region: "main", panel: "labArtifacts" },
      ],
    },
  },
} satisfies NonNullable<ExtensionDefinition["modes"]>;

export const createLabPanels = (baseUrl: string) =>
  ({
    labOverview: {
      title: l10n("panels.labOverview.title", "Overview"),
      icon: "layout-dashboard",
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
          "resource.open",
        ],
      },
    },
    labArtifacts: {
      title: l10n("panels.labArtifacts.title", "Artifacts"),
      icon: "package-search",
      region: "main",
      closable: false,
      dataTableRenderer: "glassLabArtifacts",
      eligibleLocations: { resourceKinds: ["extension-view"] },
      panelMenus: {
        create: {
          title: l10n("panels.labArtifacts.menus.create", "Create artifacts"),
          side: "right",
          controlsRenderer: "labArtifactCreate",
        },
      },
    },
    labCams: {
      title: l10n("panels.labCams.title", "Cams"),
      icon: "cctv",
      region: "main",
      closable: false,
      // Like the Artifacts table: a sub-panel tab beside the Overview location.
      eligibleLocations: { resourceKinds: ["extension-view"] },
      webview: {
        entry: packageAsset("./src/views/lab-cams.tsx", baseUrl),
        capabilities: ["commands.execute"],
      },
      panelMenus: {
        cameras: {
          title: l10n("panels.labCams.menus.cameras", "Cameras"),
          side: "left",
          treeRenderer: "labCams",
        },
      },
    },
    labStatusBar: {
      title: l10n("panels.labStatusBar.title", "Lab status"),
      region: "status",
      closable: false,
      webview: {
        entry: packageAsset("./src/views/lab-status-bar.tsx", baseUrl),
        capabilities: ["commands.execute"],
      },
    },
    labArtifactDetail: {
      title: l10n("panels.labArtifactDetail.title", "Artifact"),
      icon: "package-search",
      region: "side",
      closable: true,
      resourceKind: "glass-lab-artifact",
      webview: { entry: packageAsset("./src/views/lab-artifact.tsx", baseUrl) },
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
          "resource.open",
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

export const labActivityItems = {
  createArtifact: {
    title: l10n("activityItems.createArtifact.title", "Create artifact"),
    icon: "package-plus",
    modes: ["pstdio.extension-lab.lab"],
    command: commandRef("extension-lab.glass-lab-artifacts.create"),
  },
  projectHome: {
    title: l10n("activityItems.projectHome.title", "Project home"),
    icon: "house",
    modes: ["pstdio.extension-lab.lab"],
    placement: "last",
    command: "workbench.action.switchMode",
    params: { modeId: "project" },
  },
} satisfies NonNullable<ExtensionDefinition["activityItems"]>;

export const labTreeItems = {
  labPage: {
    target: "workbench.left.tree",
    group: "Lab",
    label: l10n("routes.lab.label", "Lab"),
    icon: "flask-conical",
    action: {
      kind: "command",
      command: "workbench.action.switchMode",
      params: { modeId: "pstdio.extension-lab.lab" },
    },
  },
  faultyPage: {
    target: "workbench.left.tree",
    group: "Lab",
    label: l10n("routes.faulty.label", "Lab (faulty)"),
    icon: "flask-conical-off",
    action: { kind: "route", route: "lab-faulty" },
  },
} satisfies NonNullable<ExtensionDefinition["treeItems"]>;

export const labDataTableRenderers = {
  glassLabArtifacts: {
    title: "Artifacts",
    resourceKind: "glass-lab-artifact",
    query: (ctx, input) => runLabCommand(labCommands["glass-lab-artifacts.query"], input)(ctx),
    onRowActivate: (_ctx, { row }) =>
      row.resource ? { kind: "resource", resource: row.resource, input: { strategy: "replace-active" } } : undefined,
    rowActions: [
      {
        id: "delete",
        label: "Delete artifact",
        icon: "trash",
        destructive: true,
        command: commandRef("extension-lab.glass-lab-artifacts.delete"),
      },
    ],
    emptyTitle: "No artifacts found",
    emptyDescription: "Create one from the panel's Create artifacts menu to begin the catalog.",
  },
} satisfies NonNullable<ExtensionDefinition["dataTableRenderers"]>;

export const labTreeRenderers = {
  labCams: {
    title: l10n("treeRenderers.labCams.title", "Cameras"),
    icon: "cctv",
    body: (ctx, input) => runLabCommand(labCommands["cams.tree"], input)(ctx),
    defaultExpandedSectionIds: ["cameras"],
  },
} satisfies NonNullable<ExtensionDefinition["treeRenderers"]>;

export const labControlsRenderers = {
  labArtifactCreate: {
    title: l10n("controls.labArtifactCreate.title", "Create artifacts"),
    query: (ctx, input) => runLabCommand(labCommands["artifact-menu.query"], input)(ctx),
    onValueChange: (ctx, input) => runLabCommand(labCommands["artifact-menu.update"], input)(ctx),
    defaultValues: {},
  },
} satisfies NonNullable<ExtensionDefinition["controlsRenderers"]>;

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
