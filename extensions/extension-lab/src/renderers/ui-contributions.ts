import { commandRef, type ExtensionDefinition, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { listCams } from "../commands/cams-commands";
import { queryArtifactMenu, queryGlassLabArtifacts, updateArtifactMenu } from "../commands/glass-lab-artifacts-command";
import { labArtifactsChanged } from "../events";

export const labModes = {
  lab: {
    id: "pstdio.extension-lab.lab",
    label: l10n("modes.lab.label", "Lab"),
    icon: "flask-conical",
    // No "secondary": the Lab has no use for it, and omitting it removes the
    // secondary panel chrome — including the Terminal entry in its "+" menu.
    panelRegions: ["main", "side"],
    resources: {
      "glass-lab-artifact": {},
    },
  },

  // Animation and Sculpt accept the same blend-project resource and arrange it
  // differently: the stage stays required in main while the supporting panels
  // swap regions. Switching modes keeps the resource and restores each layout.
  animation: {
    id: "pstdio.extension-lab.animation",
    label: l10n("modes.animation.label", "Animation"),
    icon: "clapperboard",
    panelRegions: ["main", "secondary", "side"],
    resources: {
      "blend-project": {},
    },
  },
  sculpt: {
    id: "pstdio.extension-lab.sculpt",
    label: l10n("modes.sculpt.label", "Sculpt"),
    icon: "hammer",
    panelRegions: ["main", "secondary", "side"],
    resources: {
      "blend-project": {
        panels: {
          labCams: { region: "side" },
          labArtifacts: { region: "secondary" },
        },
      },
    },
  },
} satisfies NonNullable<ExtensionDefinition["modes"]>;

// The Glass Lab artifact is an attached resource: opening one adds an inspector
// beside the Lab's own location instead of replacing it.
export const labResourceKinds = {
  "glass-lab-artifact": {
    surface: "attached",
    label: l10n("resourceKinds.glassLabArtifact.label", "Artifact"),
    icon: "package-search",
    slots: { inspector: { cardinality: "many", external: true } },
  },
  // The blend project is one resource that two modes arrange differently. It is the
  // fixture for "one resource, different layouts per mode".
  "blend-project": {
    surface: "primary",
    label: l10n("resourceKinds.blendProject.label", "Blend project"),
    icon: "box",
    slots: {
      primary: { cardinality: "one", external: false },
      navigation: { cardinality: "one", external: true },
      inspector: { cardinality: "many", external: true },
    },
  },
} satisfies NonNullable<ExtensionDefinition["resourceKinds"]>;

// The status bar is chrome, not a docked panel: the host renders it in the status
// surface for the Lab mode and it takes no part in persisted layout.
export const createLabStatusItems = (baseUrl: string) =>
  ({
    labStatusBar: {
      title: l10n("panels.labStatusBar.title", "Lab status"),
      when: { mode: "pstdio.extension-lab.lab" },
      webview: {
        entry: packageAsset("./src/views/lab-status-bar.tsx", baseUrl),
        capabilities: ["commands.execute"],
      },
    },
  }) satisfies NonNullable<ExtensionDefinition["statusItems"]>;

export const createLabPanels = (baseUrl: string) =>
  ({
    labOverview: {
      title: l10n("panels.labOverview.title", "Overview"),
      icon: "layout-dashboard",
      show: [
        { region: "main", required: true },
        { for: "blend-project", region: "main", required: true },
      ],
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
      show: [{ region: "main" }, { for: "blend-project", region: "side", allowedRegions: ["side", "secondary"] }],
      renderer: { kind: "dataTable", id: "glassLabArtifacts" },
      panelMenus: {
        create: {
          title: l10n("panels.labArtifacts.menus.create", "Create artifacts"),
          side: "right",
          renderer: { kind: "controls", id: "labArtifactCreate" },
        },
      },
    },
    labCams: {
      title: l10n("panels.labCams.title", "Cams"),
      icon: "cctv",
      show: [
        { region: "main" },
        { for: "blend-project", region: "sidenav", allowedRegions: ["sidenav", "side"], required: true },
      ],
      webview: {
        entry: packageAsset("./src/views/lab-cams.tsx", baseUrl),
        capabilities: ["commands.execute"],
      },
      panelMenus: {
        cameras: {
          title: l10n("panels.labCams.menus.cameras", "Cameras"),
          side: "left",
          renderer: { kind: "tree", id: "labCams" },
        },
      },
    },
    labArtifactDetail: {
      title: l10n("panels.labArtifactDetail.title", "Artifact"),
      icon: "package-search",
      show: { for: "glass-lab-artifact", region: "side" },
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
    action: { kind: "view", viewId: "faultyPage" },
  },
} satisfies NonNullable<ExtensionDefinition["treeItems"]>;

export const labDataTableRenderers = {
  glassLabArtifacts: {
    title: "Artifacts",
    resourceKind: "glass-lab-artifact",
    query: queryGlassLabArtifacts,
    refreshEvents: [labArtifactsChanged],
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
    body: listCams,
    defaultExpandedSectionIds: ["cameras"],
  },
} satisfies NonNullable<ExtensionDefinition["treeRenderers"]>;

export const labControlsRenderers = {
  labArtifactCreate: {
    title: l10n("controls.labArtifactCreate.title", "Create artifacts"),
    query: queryArtifactMenu,
    onValueChange: updateArtifactMenu,
    refreshEvents: [labArtifactsChanged],
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
