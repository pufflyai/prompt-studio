import {
  defineActivityItem,
  defineMode,
  defineNavigationItem,
  definePage,
  definePlacement,
  defineResourceKind,
  defineSettingsPanel,
  defineSettingsSection,
  defineStatusBarItem,
  defineViewMenu,
  l10n,
  workbenchCommands,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { createGlassLabArtifactCommand } from "../commands/glass-lab-artifacts-command";
import { createLabViews } from "./lab-views";

// The one real mode: extension-lab must exercise the mode contribution itself.
export const labMode = defineMode({
  id: "lab",
  label: l10n("modes.lab.label", "Lab"),
  icon: "flask-conical",
});

export const glassLabArtifactKind = defineResourceKind({
  id: "glass-lab-artifact",
  label: l10n("resourceKinds.glassLabArtifact.label", "Artifact"),
  icon: "package-search",
  // Bound by both pages below: the same artifact renders as an inspector on the
  // lab page and as a side tab on the blend page, depending on the target.
});

export const blendProjectKind = defineResourceKind({
  id: "blend-project",
  label: l10n("resourceKinds.blendProject.label", "Blend project"),
  icon: "box",
});

export const labResourceKinds = [glassLabArtifactKind, blendProjectKind];

export const labSettingsSection = defineSettingsSection({
  id: "lab",
  title: l10n("settingsSections.lab.title", "Lab"),
  order: 30,
});

export const createLabUi = (baseUrl: string) => {
  const {
    artifactCreate,
    artifactDetail,
    artifacts,
    cameraTree,
    cams,
    faultyPage: faultyView,
    globalSettings,
    labPage: labMainView,
    overview,
    projectSettings,
    status,
    workflow,
  } = createLabViews(baseUrl);

  // A mode's placements (static views only) are its default composition, shown
  // while no page is active.
  const placements = [
    // The Lab keeps no secondary panel (no terminals), so the board only moves
    // within the side region.
    definePlacement({
      id: "workflow.lab",
      mode: labMode.ref,
      item: { kind: "view", view: workflow.ref },
      region: "side",
      movableTo: ["side"],
    }),
    definePlacement({
      id: "status.lab",
      mode: labMode.ref,
      item: { kind: "view", view: overview.ref },
      region: "main",
      required: true,
    }),
  ];

  // Exercises static + bound slots and `many` cardinality in a side region.
  const labPage = definePage({
    id: "lab",
    title: l10n("pages.lab.title", "Lab"),
    icon: "flask-conical",
    path: "lab",
    slots: [
      { id: "overview", region: "main", view: overview.ref, closable: false },
      { id: "artifacts", region: "main", view: artifacts.ref },
      { id: "cams", region: "main", view: cams.ref },
      { id: "inspector", region: "side", cardinality: "many" },
    ],
    bindings: [
      {
        resourceKind: glassLabArtifactKind.ref,
        view: artifactDetail.ref,
        slot: "inspector",
      },
    ],
  });

  // Exercises a resource-first page (the bound tab is the screen) and a two-kind page.
  const blendPage = definePage({
    id: "blend",
    title: l10n("pages.blend.title", "Blend"),
    icon: "box",
    slots: [
      { id: "scene", region: "main", cardinality: "one", closable: false },
      { id: "cams", region: "sidenav" },
      { id: "artifacts", region: "side", cardinality: "many" },
    ],
    bindings: [
      { resourceKind: blendProjectKind.ref, view: overview.ref, slot: "scene" },
      { resourceKind: blendProjectKind.ref, view: cams.ref, slot: "cams" },
      {
        resourceKind: glassLabArtifactKind.ref,
        view: artifactDetail.ref,
        slot: "artifacts",
      },
    ],
  });

  // Views are no longer navigation targets, so the sandboxed lab webview and the
  // faulty webview each get their own page.
  // The sandbox webview opens a resource through the `resource.open` capability, so the
  // page it lives on has to present that kind — an emission goes where the page binds it.
  const labWebviewPage = definePage({
    id: "lab-webview",
    title: l10n("routes.lab.label", "Lab"),
    icon: "flask-conical",
    path: "lab-webview",
    slots: [
      { id: "main", region: "main", view: labMainView.ref, closable: false },
      { id: "project", region: "main", cardinality: "many" },
    ],
    bindings: [{ resourceKind: blendProjectKind.ref, view: overview.ref, slot: "project" }],
  });

  const faultyLabPage = definePage({
    id: "lab-faulty",
    title: l10n("routes.faulty.label", "Lab (faulty)"),
    icon: "flask-conical-off",
    path: "lab-faulty",
    slots: [{ id: "main", region: "main", view: faultyView.ref }],
  });

  return {
    views: [
      overview,
      artifacts,
      cams,
      artifactDetail,
      status,
      labMainView,
      faultyView,
      projectSettings,
      globalSettings,
      artifactCreate,
      cameraTree,
      workflow,
    ],
    pages: [labPage, blendPage, labWebviewPage, faultyLabPage],
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
        label: l10n("routes.labMode.label", "Lab mode"),
        icon: "flask-conical",
        action: {
          kind: "command",
          target: { command: workbenchCommands.switchMode, params: { modeId: labMode.id } },
        },
      }),
      defineNavigationItem({
        id: "lab-page",
        slot: workbenchSlots.projectNavigation,
        group: "Lab",
        label: l10n("pages.lab.title", "Lab"),
        icon: "flask-conical",
        action: { kind: "page", page: labPage.ref },
      }),
      defineNavigationItem({
        id: "blend",
        slot: workbenchSlots.projectNavigation,
        group: "Lab",
        label: l10n("pages.blend.title", "Blend"),
        icon: "box",
        action: { kind: "page", page: blendPage.ref },
      }),
      defineNavigationItem({
        id: "faulty",
        slot: workbenchSlots.projectNavigation,
        group: "Lab",
        label: l10n("routes.faulty.label", "Lab (faulty)"),
        icon: "flask-conical-off",
        action: { kind: "page", page: faultyLabPage.ref },
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
