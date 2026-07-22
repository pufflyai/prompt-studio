import type {
  Disposable,
  TreeNode,
  WorkbenchModeActivationContext,
  WorkbenchModuleContributionContext,
} from "../../../core";
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
    ctx.layout.registerWidget({
      id: projectWidgetIds.overview,
      title: "Project overview",
      region: "main",
      singleton: true,
      rendererId: projectWidgetIds.overview,
      resourceKinds: [projectResourceKind],
    }),
    ctx.layout.registerWidget({
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
      getBody: () => buildProjectTreeSections(),
      getChildren: () => [],
    }),
    ctx.layout.registerWidget({
      id: "workbench-modes.project.navigation",
      title: workbenchModes.project.label,
      region: "sidenav",
      rendererId: "workbench-modes.project.navigation",
    }),
    ctx.resources.registerOpener({
      id: "workbench-modes.project.opener",
      canOpen: (resource) => resource.kind === projectResourceKind,
      open: (resource, input) =>
        ctx.layout.openWidget(projectWidgetIds.overview, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    }),
  ];

  ctx.layout.openWidget(activityBarWidgetId, { pinned: true });
  ctx.layout.openWidget("workbench-modes.project.navigation");
  ctx.layout.openWidget(projectWidgetIds.feed, { pinned: true });
  ctx.layout.openWidget(projectWidgetIds.overview, { resource: projectItemResource(projectItems[0]) });

  return disposables;
};

export const registerProjectMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: workbenchModes.project.id,
    label: workbenchModes.project.label,
    activate: setupProjectMode,
  });
};
