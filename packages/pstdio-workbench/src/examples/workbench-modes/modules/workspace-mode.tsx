import type { Disposable, TreeNode, WorkbenchModeActivationContext, WorkbenchModuleContext } from "../../../core";
import { WORKBENCH_TERMINAL_WIDGET_ID } from "../../../react/terminal/terminal-module";
import { WorkspaceDiff, WorkspaceEditor, WorkspaceMainHeader } from "../components/workspace-views";
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
    ctx.layout.registerPanel({
      closable: false,
      id: MAIN_HEADER_WIDGET_ID,
      title: "Workspace mode header",
      region: "main-header",
      singleton: true,
      rendererId: MAIN_HEADER_WIDGET_ID,
    }),
    ctx.layout.registerPanel({
      closable: false,
      id: workspaceWidgetIds.editor,
      title: "Editor",
      region: "main",
      singleton: true,
      rendererId: workspaceWidgetIds.editor,
      resourceKinds: [workspaceResourceKind],
    }),
    ctx.layout.registerPanel({
      closable: false,
      id: workspaceWidgetIds.diff,
      title: "Diff",
      region: "main-right-menu",
      singleton: true,
      rendererId: workspaceWidgetIds.diff,
      regionSize: { defaultPx: 320, minPx: 240 },
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
    ctx.renderers.registerTreeRenderer({
      id: "workbench-modes.workspace.files",
      title: "Files",
      defaultExpandedSectionIds: ["workspace.changed"],
      getBody: () => buildWorkspaceTreeSections(),
      getChildren: () => [],
    }),
    ctx.layout.registerPanel({
      closable: false,
      id: "workbench-modes.workspace.files",
      title: "Files",
      region: "main-left-menu",
      rendererId: "workbench-modes.workspace.files",
    }),
    ctx.resources.registerPresenter({
      id: "workbench-modes.workspace.presenter",
      canOpen: (resource) => resource.kind === workspaceResourceKind,
      open: (resource, input) =>
        ctx.layout.openPanel(workspaceWidgetIds.editor, {
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "activate-or-open" },
          resource,
          title: resource.label,
        }),
    }),
  ];

  return disposables;
};

const seedWorkspaceMode = (ctx: WorkbenchModeActivationContext) => {
  ctx.layout.openPanel(activityBarWidgetId, { pinned: true });
  ctx.layout.openPanel(MAIN_HEADER_WIDGET_ID, { pinned: true });
  ctx.layout.openPanel("workbench-modes.workspace.files");
  ctx.layout.openPanel(workspaceWidgetIds.diff, { pinned: true });
  // The terminal panel is the host-owned surface registered by
  // createWorkbenchTerminalModule — workspace mode only opens it.
  ctx.layout.openPanel(WORKBENCH_TERMINAL_WIDGET_ID, { pinned: true });
  ctx.layout.openPanel(workspaceWidgetIds.editor, { resource: workspaceFileResource(workspaceFiles[0]) });
};

export const registerWorkspaceMode = (ctx: WorkbenchModuleContext) => {
  ctx.modes.registerMode({
    id: workbenchModes.workspace.id,
    label: workbenchModes.workspace.label,
    panels: ["main", "secondary"],
    activate: setupWorkspaceMode,
    seed: seedWorkspaceMode,
  });
};
