import type {
  Disposable,
  TreeNode,
  WorkbenchModeActivationContext,
  WorkbenchModuleContributionContext,
} from "../../../core";
import { WorkspaceDiff, WorkspaceEditor, WorkspaceMainHeader, WorkspaceTerminal } from "../components/workspace-views";
import {
  activityBarWidgetId,
  workbenchModes,
  workspaceFileResource,
  workspaceFiles,
  workspaceResourceKind,
  workspaceWidgetIds,
} from "../mock-data/data";

const buildWorkspaceTreeSections = () => [
  {
    id: "workspace.changed",
    label: "Changed files",
    nodes: workspaceFiles.map((file): TreeNode => {
      const resource = workspaceFileResource(file);
      return { id: resource.uri, label: file.label, icon: "FileCode", resource };
    }),
  },
];

const MAIN_HEADER_WIDGET_ID = "workbench-modes.workspace.mainHeader";

const setupWorkspaceMode = (ctx: WorkbenchModeActivationContext): Disposable[] => {
  const disposables: Disposable[] = [
    ctx.layout.registerWidget({
      id: MAIN_HEADER_WIDGET_ID,
      title: "Workspace mode header",
      area: "main-header",
      singleton: true,
      rendererId: MAIN_HEADER_WIDGET_ID,
    }),
    ctx.layout.registerWidget({
      id: workspaceWidgetIds.editor,
      title: "Editor",
      area: "main",
      singleton: true,
      rendererId: workspaceWidgetIds.editor,
      resourceKinds: [workspaceResourceKind],
    }),
    ctx.layout.registerWidget({
      id: workspaceWidgetIds.diff,
      title: "Diff",
      area: "main-right",
      singleton: true,
      rendererId: workspaceWidgetIds.diff,
      areaSize: { defaultPx: 320, minPx: 240 },
    }),
    ctx.layout.registerWidget({
      id: workspaceWidgetIds.terminal,
      title: "Terminal",
      area: "main-bottom",
      singleton: true,
      rendererId: workspaceWidgetIds.terminal,
      areaSize: { defaultPx: 200, minPx: 120 },
    }),
    ctx.renderers.registerRenderer({
      id: MAIN_HEADER_WIDGET_ID,
      render: () => <WorkspaceMainHeader />,
    }),
    ctx.renderers.registerRenderer({
      id: workspaceWidgetIds.editor,
      render: (input) => <WorkspaceEditor input={input} />,
    }),
    ctx.renderers.registerRenderer({
      id: workspaceWidgetIds.diff,
      render: (input) => <WorkspaceDiff input={input} />,
    }),
    ctx.renderers.registerRenderer({
      id: workspaceWidgetIds.terminal,
      render: () => <WorkspaceTerminal />,
    }),
    ctx.renderers.registerTreeRenderer({
      id: "workbench-modes.workspace.files",
      title: "Files",
      getBody: () => buildWorkspaceTreeSections(),
      getChildren: () => [],
    }),
    ctx.layout.registerWidget({
      id: "workbench-modes.workspace.files",
      title: "Files",
      area: "main-left",
      rendererId: "workbench-modes.workspace.files",
    }),
    ctx.resources.registerOpener({
      id: "workbench-modes.workspace.opener",
      canOpen: (resource) => resource.kind === workspaceResourceKind,
      open: (resource, input) =>
        ctx.layout.openWidget(workspaceWidgetIds.editor, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    }),
  ];

  ctx.layout.openWidget(activityBarWidgetId, { pinned: true });
  ctx.layout.openWidget(MAIN_HEADER_WIDGET_ID, { pinned: true });
  ctx.layout.openWidget("workbench-modes.workspace.files");
  ctx.layout.openWidget(workspaceWidgetIds.diff, { pinned: true });
  ctx.layout.openWidget(workspaceWidgetIds.terminal, { pinned: true });
  ctx.layout.openWidget(workspaceWidgetIds.editor, { resource: workspaceFileResource(workspaceFiles[0]) });

  return disposables;
};

export const registerWorkspaceMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: workbenchModes.workspace.id,
    label: workbenchModes.workspace.label,
    activate: setupWorkspaceMode,
  });
};
