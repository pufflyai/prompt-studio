import type { Disposable, TreeNode, WorkbenchModeActivationContext, WorkbenchModuleContext } from "../../../core";
import { ProjectFeed, ProjectOverview } from "../components/project-views";
import {
  activityBarWidgetId,
  projectFolders,
  projectItemResource,
  projectItems,
  projectResourceKind,
  projectWidgetIds,
  workbenchModes,
} from "../mock-data/data";

const buildProjectTreeSections = () =>
  projectFolders.map((folder) => ({
    id: folder.id,
    label: folder.label,
    nodes: folder.itemIds.flatMap((itemId): TreeNode[] => {
      const item = projectItems.find((candidate) => candidate.id === itemId);
      if (!item) return [];
      const resource = projectItemResource(item);
      return [{ id: resource.uri, label: item.label, icon: resource.icon, resource }];
    }),
  }));

const setupProjectMode = (ctx: WorkbenchModeActivationContext): Disposable[] => {
  const disposables: Disposable[] = [
    ctx.layout.registerPanel({
      closable: false,
      id: projectWidgetIds.overview,
      title: "Project overview",
      region: "main",
      singleton: true,
      rendererId: projectWidgetIds.overview,
      resourceKinds: [projectResourceKind],
    }),
    ctx.layout.registerPanel({
      closable: false,
      id: projectWidgetIds.feed,
      title: "Activity feed",
      region: "secondary",
      singleton: true,
      rendererId: projectWidgetIds.feed,
    }),
    ctx.renderers.registerRenderer({
      id: projectWidgetIds.overview,
      render: (input) => <ProjectOverview input={input} />,
    }),
    ctx.renderers.registerRenderer({
      id: projectWidgetIds.feed,
      render: () => <ProjectFeed />,
    }),
    ctx.renderers.registerTreeRenderer({
      id: "workbench-modes.project.navigation",
      title: workbenchModes.project.label,
      defaultExpandedSectionIds: projectFolders.map((folder) => folder.id),
      getBody: () => buildProjectTreeSections(),
      getChildren: () => [],
    }),
    ctx.layout.registerPanel({
      closable: false,
      id: "workbench-modes.project.navigation",
      title: workbenchModes.project.label,
      region: "sidenav",
      rendererId: "workbench-modes.project.navigation",
    }),
    ctx.resources.registerPresenter({
      id: "workbench-modes.project.presenter",
      canOpen: (resource) => resource.kind === projectResourceKind,
      open: (resource, input) =>
        ctx.layout.openPanel(projectWidgetIds.overview, {
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "activate-or-open" },
          resource,
          title: resource.label,
        }),
    }),
  ];

  return disposables;
};

const seedProjectMode = (ctx: WorkbenchModeActivationContext) => {
  ctx.layout.openPanel(activityBarWidgetId, { pinned: true });
  ctx.layout.openPanel("workbench-modes.project.navigation");
  ctx.layout.openPanel(projectWidgetIds.feed, { pinned: true });
  ctx.layout.openPanel(projectWidgetIds.overview, { resource: projectItemResource(projectItems[0]) });
};

export const registerProjectMode = (ctx: WorkbenchModuleContext) => {
  ctx.modes.registerMode({
    id: workbenchModes.project.id,
    label: workbenchModes.project.label,
    panels: ["main", "secondary"],
    activate: setupProjectMode,
    seed: seedProjectMode,
  });
};
