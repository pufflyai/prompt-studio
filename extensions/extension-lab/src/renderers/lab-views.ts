import { defineView, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { listCams } from "../commands/cams-commands";
import {
  deleteGlassLabArtifactCommand,
  queryArtifactMenu,
  queryGlassLabArtifacts,
  updateArtifactMenu,
} from "../commands/glass-lab-artifacts-command";
import { queryLabWorkflowArtifacts, updateLabWorkflowArtifact } from "../data/lab-workflow-artifacts";
import { labArtifactsChanged } from "../events";
import { labWorkflowStatuses } from "./lab-workflow-statuses";

export const createLabViews = (baseUrl: string) => {
  const overview = defineView({
    id: "overview",
    title: l10n("panels.labOverview.title", "Overview"),
    icon: "layout-dashboard",
    body: {
      kind: "webview",
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
  });

  const artifacts = defineView({
    id: "artifacts",
    title: l10n("panels.labArtifacts.title", "Artifacts"),
    icon: "package-search",
    body: {
      kind: "dataTable",
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
          command: deleteGlassLabArtifactCommand.ref,
        },
      ],
      emptyTitle: "No artifacts found",
      emptyDescription: "Create an artifact to begin the catalog.",
    },
  });

  const cams = defineView({
    id: "cams",
    title: l10n("panels.labCams.title", "Cams"),
    icon: "cctv",
    body: {
      kind: "webview",
      entry: packageAsset("./src/views/lab-cams.tsx", baseUrl),
      capabilities: ["commands.execute"],
    },
  });

  const artifactDetail = defineView({
    id: "artifact-detail",
    title: l10n("panels.labArtifactDetail.title", "Artifact"),
    icon: "package-search",
    body: { kind: "webview", entry: packageAsset("./src/views/lab-artifact.tsx", baseUrl) },
  });

  const status = defineView({
    id: "status",
    title: l10n("panels.labStatusBar.title", "Lab status"),
    body: {
      kind: "webview",
      entry: packageAsset("./src/views/lab-status-bar.tsx", baseUrl),
      capabilities: ["commands.execute"],
    },
  });

  const labPage = defineView({
    id: "lab-page",
    title: l10n("routes.lab.label", "Lab"),
    path: "lab",
    body: {
      kind: "webview",
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
  });

  const faultyPage = defineView({
    id: "faulty-page",
    title: l10n("routes.faulty.label", "Lab (faulty)"),
    path: "lab-faulty",
    icon: "flask-conical-off",
    body: { kind: "webview", entry: packageAsset("./src/views/faulty-main.tsx", baseUrl) },
  });

  const projectSettings = defineView({
    id: "project-settings",
    title: l10n("settingsPanels.project.title", "Lab (project)"),
    icon: "settings",
    body: {
      kind: "webview",
      entry: packageAsset("./src/views/settings-project.tsx", baseUrl),
      capabilities: ["extension.settings.all", "extension.settings.set"],
    },
  });

  const globalSettings = defineView({
    id: "global-settings",
    title: l10n("settingsPanels.global.title", "Lab (global)"),
    icon: "settings",
    body: {
      kind: "webview",
      entry: packageAsset("./src/views/settings-global.tsx", baseUrl),
      capabilities: ["extension.settings.all", "extension.settings.set"],
    },
  });

  const artifactCreate = defineView({
    id: "artifact-create",
    title: l10n("controls.labArtifactCreate.title", "Create artifacts"),
    body: {
      kind: "controls",
      query: queryArtifactMenu,
      onValueChange: updateArtifactMenu,
      refreshEvents: [labArtifactsChanged],
      defaultValues: {},
    },
  });

  const cameraTree = defineView({
    id: "camera-tree",
    title: l10n("treeRenderers.labCams.title", "Cameras"),
    icon: "cctv",
    body: { kind: "tree", body: listCams, defaultExpandedSectionIds: ["cameras"] },
  });

  const workflow = defineView({
    id: "workflow",
    title: "Workflow status demo",
    icon: "square-kanban",
    body: {
      kind: "kanban",
      attributes: [
        {
          id: "status",
          label: "Status",
          type: { kind: "status", statuses: labWorkflowStatuses.ref },
          groupable: true,
          displayable: true,
        },
      ],
      query: queryLabWorkflowArtifacts,
      refreshEvents: [labArtifactsChanged],
      onAttributeChange: updateLabWorkflowArtifact,
      onRowActivate: (_ctx, { row }) =>
        row.resource ? { kind: "resource", resource: row.resource, input: { strategy: "replace-active" } } : undefined,
      defaultSettings: {
        viewMode: "board",
        columnGrouping: "status",
        rowGrouping: "none",
        ordering: { attributeId: "status", direction: "asc" },
        displayProperties: [],
      },
    },
  });

  return {
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
  };
};
