import {
  defineActivityItem,
  defineMode,
  defineNavigationItem,
  definePlacement,
  defineResourceKind,
  defineResourceView,
  defineSettingsPanel,
  defineSettingsSection,
  defineStatusBarItem,
  defineViewMenu,
  l10n,
  resourceSlotRef,
  workbenchCommands,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { createGlassLabArtifactCommand } from "../commands/glass-lab-artifacts-command";
import { createLabViews } from "./lab-views";

export const labMode = defineMode({
  id: "lab",
  label: l10n("modes.lab.label", "Lab"),
  icon: "flask-conical",
  regions: ["main", "side"],
});

export const animationMode = defineMode({
  id: "animation",
  label: l10n("modes.animation.label", "Animation"),
  icon: "clapperboard",
  regions: ["sidenav", "main", "side"],
});

export const sculptMode = defineMode({
  id: "sculpt",
  label: l10n("modes.sculpt.label", "Sculpt"),
  icon: "hammer",
  regions: ["main", "secondary", "side"],
});

export const labModes = [labMode, animationMode, sculptMode];

export const glassLabArtifactKind = defineResourceKind({
  id: "glass-lab-artifact",
  surface: "attached",
  label: l10n("resourceKinds.glassLabArtifact.label", "Artifact"),
  icon: "package-search",
  slots: [{ id: "inspector", cardinality: "many", access: "public" }],
});

export const blendProjectKind = defineResourceKind({
  id: "blend-project",
  surface: "primary",
  label: l10n("resourceKinds.blendProject.label", "Blend project"),
  icon: "box",
  slots: [
    { id: "primary", cardinality: "one", access: "owner" },
    { id: "navigation", cardinality: "one", access: "public" },
    { id: "inspector", cardinality: "many", access: "public" },
  ],
});

export const labResourceKinds = [glassLabArtifactKind, blendProjectKind];

export const labSettingsSection = defineSettingsSection({
  id: "lab",
  title: l10n("settingsSections.lab.title", "Lab"),
  order: 30,
});

const artifactInspector = resourceSlotRef(glassLabArtifactKind.ref, "inspector");
const blendPrimary = resourceSlotRef(blendProjectKind.ref, "primary");
const blendNavigation = resourceSlotRef(blendProjectKind.ref, "navigation");
const blendInspector = resourceSlotRef(blendProjectKind.ref, "inspector");

export const createLabUi = (baseUrl: string) => {
  const {
    artifactCreate,
    artifactDetail,
    artifacts,
    cameraTree,
    cams,
    faultyPage,
    globalSettings,
    labPage,
    overview,
    projectSettings,
    status,
    workflow,
  } = createLabViews(baseUrl);

  const placements = [
    definePlacement({
      id: "overview.lab",
      mode: labMode.ref,
      item: { kind: "view", view: overview.ref },
      region: "main",
      required: true,
    }),
    definePlacement({
      id: "artifacts.lab",
      mode: labMode.ref,
      item: { kind: "view", view: artifacts.ref },
      region: "main",
    }),
    definePlacement({ id: "cams.lab", mode: labMode.ref, item: { kind: "view", view: cams.ref }, region: "main" }),
    definePlacement({
      id: "workflow.lab",
      mode: labMode.ref,
      item: { kind: "view", view: workflow.ref },
      region: "main",
    }),
    definePlacement({
      id: "artifact-inspector.lab",
      mode: labMode.ref,
      item: { kind: "resource-slot", slot: artifactInspector },
      region: "side",
    }),
    definePlacement({
      id: "blend-primary.animation",
      mode: animationMode.ref,
      item: { kind: "resource-slot", slot: blendPrimary },
      region: "main",
      required: true,
    }),
    definePlacement({
      id: "blend-navigation.animation",
      mode: animationMode.ref,
      item: { kind: "resource-slot", slot: blendNavigation },
      region: "sidenav",
      required: true,
    }),
    definePlacement({
      id: "blend-inspector.animation",
      mode: animationMode.ref,
      item: { kind: "resource-slot", slot: blendInspector },
      region: "side",
      movableTo: ["side", "secondary"],
    }),
    definePlacement({
      id: "blend-primary.sculpt",
      mode: sculptMode.ref,
      item: { kind: "resource-slot", slot: blendPrimary },
      region: "main",
      required: true,
    }),
    definePlacement({
      id: "blend-navigation.sculpt",
      mode: sculptMode.ref,
      item: { kind: "resource-slot", slot: blendNavigation },
      region: "side",
    }),
    definePlacement({
      id: "blend-inspector.sculpt",
      mode: sculptMode.ref,
      item: { kind: "resource-slot", slot: blendInspector },
      region: "secondary",
    }),
  ];

  return {
    views: [
      overview,
      artifacts,
      cams,
      artifactDetail,
      status,
      labPage,
      faultyPage,
      projectSettings,
      globalSettings,
      artifactCreate,
      cameraTree,
      workflow,
    ],
    resourceViews: [
      defineResourceView({
        id: "artifact-detail",
        resourceKind: glassLabArtifactKind.ref,
        slot: artifactInspector,
        view: artifactDetail.ref,
      }),
      defineResourceView({
        id: "blend-overview",
        resourceKind: blendProjectKind.ref,
        slot: blendPrimary,
        view: overview.ref,
      }),
      defineResourceView({
        id: "blend-cams",
        resourceKind: blendProjectKind.ref,
        slot: blendNavigation,
        view: cams.ref,
      }),
      defineResourceView({
        id: "blend-artifacts",
        resourceKind: blendProjectKind.ref,
        slot: blendInspector,
        view: artifacts.ref,
      }),
    ],
    viewMenus: [
      defineViewMenu({
        id: "artifacts.create",
        owner: artifacts.ref,
        view: artifactCreate.ref,
        side: "right",
      }),
      defineViewMenu({
        id: "cams.cameras",
        owner: cams.ref,
        view: cameraTree.ref,
        side: "left",
      }),
    ],
    placements,
    navigationItems: [
      defineNavigationItem({
        id: "lab",
        slot: workbenchSlots.projectNavigation,
        group: "Lab",
        label: l10n("routes.lab.label", "Lab"),
        icon: "flask-conical",
        action: {
          kind: "command",
          target: { command: workbenchCommands.switchMode, params: { modeId: "pstdio.extension-lab.mode.lab" } },
        },
      }),
      defineNavigationItem({
        id: "faulty",
        slot: workbenchSlots.projectNavigation,
        group: "Lab",
        label: l10n("routes.faulty.label", "Lab (faulty)"),
        icon: "flask-conical-off",
        action: { kind: "view", view: faultyPage.ref },
      }),
    ],
    statusBarItems: [
      defineStatusBarItem({
        id: "lab",
        view: status.ref,
        slot: workbenchSlots.statusBarLeading,
        when: { mode: labMode.ref },
      }),
    ],
    settingsPanels: [
      defineSettingsPanel({
        id: "project",
        view: projectSettings.ref,
        slot: workbenchSlots.projectSettings,
        section: labSettingsSection.ref,
      }),
      defineSettingsPanel({
        id: "global",
        view: globalSettings.ref,
        slot: { id: "global.settings" },
        section: labSettingsSection.ref,
      }),
    ],
  };
};

export const labActivityItems = [
  defineActivityItem({
    id: "create-artifact",
    title: l10n("activityItems.createArtifact.title", "Create artifact"),
    icon: "package-plus",
    modes: [labMode.ref],
    command: createGlassLabArtifactCommand.ref,
  }),
  defineActivityItem({
    id: "project-home",
    title: l10n("activityItems.projectHome.title", "Project home"),
    icon: "house",
    modes: [labMode.ref],
    placement: "last",
    command: workbenchCommands.switchMode,
    params: { modeId: "project" },
  }),
];
