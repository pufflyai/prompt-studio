import type { ViewRef } from "@pstdio/sdk/extensions";
import {
  defineActivityItem,
  defineMode,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
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
  workbenchModes,
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

export const labModes = [labMode];

export const glassLabArtifactKind = defineResourceKind({
  id: "glass-lab-artifact",
  surface: "attached",
  label: l10n("resourceKinds.glassLabArtifact.label", "Artifact"),
  icon: "package-search",
  slots: [{ id: "inspector", cardinality: "many", access: "public" }],
});

export const labResourceKinds = [glassLabArtifactKind];

export const labSettingsSection = defineSettingsSection({
  id: "lab",
  title: l10n("settingsSections.lab.title", "Lab"),
  order: 30,
});

const artifactInspector = resourceSlotRef(glassLabArtifactKind.ref, "inspector");

const createLabPage = (labPage: ViewRef) =>
  definePage({
    id: "lab",
    title: l10n("routes.lab.label", "Lab"),
    icon: "flask-conical",
    path: "lab",
    mode: workbenchModes.project,
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        view: labPage,
      },
    ],
  });

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

  const labPageContribution = createLabPage(labPage.ref);

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
    pages: [labPageContribution],
    navigationItems: [
      defineNavigationItem({
        id: "lab",
        owner: workbenchModes.project,
        slot: "content",
        group: "Lab",
        label: l10n("routes.lab.label", "Lab"),
        icon: "flask-conical",
        action: { kind: "page", page: labPageContribution.ref },
      }),
      defineNavigationItem({
        id: "lab-mode",
        owner: workbenchModes.project,
        slot: "content",
        group: "Lab",
        label: l10n("routes.labMode.label", "Lab mode"),
        icon: "panels-top-left",
        action: {
          kind: "command",
          target: { command: workbenchCommands.switchMode, params: { modeId: "pstdio.extension-lab.mode.lab" } },
        },
      }),
      defineNavigationItem({
        id: "faulty",
        owner: workbenchModes.project,
        slot: "content",
        group: "Lab",
        label: l10n("routes.faulty.label", "Lab (faulty)"),
        icon: "flask-conical-off",
        action: { kind: "view", view: faultyPage.ref },
      }),
    ],
    navigationTrees: [
      defineNavigationTree({
        id: "lab-cameras",
        owner: labPageContribution.ref,
        slot: "content",
        view: cameraTree.ref,
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
