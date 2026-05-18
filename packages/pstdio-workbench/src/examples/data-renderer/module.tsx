import type {
  FilterExpression,
  ResourceRef,
  SavedViewKindContribution,
  ViewDisplayOptions,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
  WorkbenchSavedView,
} from "../../core";
import {
  dataRendererStoryProjectId,
  dataRendererStoryRendererId,
  dataRendererStoryViewKind,
  dataRendererStoryWidgetId,
  storyDefaultDisplay,
  storyDisplayPropertyOptions,
  storyFilterCategories,
  storyGroupingOptions,
  storyOrderingOptions,
  storyRows,
  storyStatusColumns,
  storyTagDefinitions,
} from "./mock-data";

const savedViewResourceKind = "savedView";
const treeViewId = "data-renderer.story.tree";
const favoriteScope = { scope: "project", projectId: dataRendererStoryProjectId } as const;

const initialViews = [
  {
    name: "Active board",
    filter: { field: "status", operator: "in", value: ["backlog", "in-progress", "review"] } as FilterExpression,
    display: storyDefaultDisplay,
  },
  {
    name: "Review queue",
    filter: { field: "status", operator: "is", value: "review" } as FilterExpression,
    display: {
      layout: "list",
      columns: ["id", "status", "assignee", "tag:priority"],
      density: "compact",
    } as ViewDisplayOptions,
  },
  {
    name: "My work",
    filter: {
      op: "and",
      children: [
        { field: "assignee", operator: "is", value: "Aure" },
        { field: "status", operator: "in", value: ["backlog", "in-progress", "review"] },
      ],
    } satisfies FilterExpression,
    display: { layout: "list", columns: ["id", "status", "tag:priority"], density: "compact" } as ViewDisplayOptions,
  },
];

const createSavedViewResource = (view: WorkbenchSavedView): ResourceRef => ({
  kind: savedViewResourceKind,
  id: view.id,
  uri: `pstdio://data-renderer-story/views/${view.id}`,
  label: view.name,
  icon: "Table",
  metadata: {
    favoriteScope,
    resourceKind: view.resourceKind,
    projectId: view.projectId,
    filter: view.filter,
    display: view.display,
  },
});

const savedViewKind: SavedViewKindContribution = {
  kind: dataRendererStoryViewKind,
  label: "Row view",
  icon: "Table",
  fields: [
    { id: "id", label: "ID", type: "string", operators: ["is", "in", "contains"] },
    { id: "title", label: "Title", type: "string", operators: ["is", "isNot", "contains"] },
    { id: "updated", label: "Updated", type: "date", operators: ["before", "after", "within"] },
    { id: "status", label: "Status", type: "enum", operators: ["is", "in"] },
    { id: "assignee", label: "Assignee", type: "user", operators: ["is", "in"] },
    { id: "tag:priority", label: "Priority", type: "enum", operators: ["is", "in"] },
    { id: "tag:area", label: "Area", type: "enum", operators: ["is", "in"] },
  ],
  layouts: ["list", "board", "table"],
  defaultDisplay: storyDefaultDisplay,
  resolveQuery: async () => ({ rows: storyRows }),
  createResource: createSavedViewResource,
};

const ensureInitialViews = async (ctx: WorkbenchModuleContributionContext) => {
  const existing = await ctx.savedViews.list({
    scope: "project",
    projectId: dataRendererStoryProjectId,
    resourceKind: dataRendererStoryViewKind,
  });
  if (existing.length > 0) return existing;

  const created: WorkbenchSavedView[] = [];
  for (const [order, view] of initialViews.entries()) {
    created.push(
      await ctx.savedViews.create({
        name: view.name,
        resourceKind: dataRendererStoryViewKind,
        scope: "project",
        projectId: dataRendererStoryProjectId,
        order,
        filter: view.filter,
        display: view.display,
      }),
    );
  }
  return created;
};

const ensureInitialFavorites = async (ctx: WorkbenchModuleContributionContext, views: WorkbenchSavedView[]) => {
  const targets = [views[0], views[1]].filter((view): view is WorkbenchSavedView => Boolean(view));

  for (const view of targets) {
    const target = createSavedViewResource(view);
    if (!(await ctx.favorites.isFavorited(target, favoriteScope))) {
      await ctx.favorites.add({ target, ...favoriteScope });
    }
  }
};

const openSavedViewResource = async (
  ctx: WorkbenchModuleContributionContext,
  resource: ResourceRef,
  input: { replaceActive?: boolean },
) => {
  const view = resource.id ? await ctx.savedViews.get(resource.id) : undefined;
  const activeResource = view ? createSavedViewResource(view) : resource;

  return ctx.layout.openWidget(dataRendererStoryWidgetId, {
    resource: activeResource,
    title: activeResource.label,
    replaceActive: input.replaceActive,
  });
};

const columnConfigById = new Map(
  storyStatusColumns.map((column) => [
    column.id,
    { color: column.color, canDragIn: true, canDragOut: column.id !== "done", canCreate: column.id !== "done" },
  ]),
);

const buildFavoritesSection = async (ctx: WorkbenchModuleContributionContext) => {
  const favorites = await ctx.favorites.list(favoriteScope);

  return {
    id: "favorites",
    label: "Favorites",
    nodes: favorites.map((favorite) => ({
      id: favorite.id,
      label: favorite.label ?? favorite.target.label ?? "Untitled",
      icon: favorite.icon ?? favorite.target.icon ?? "Star",
      resource: favorite.target,
      contextMenuActions: [
        {
          id: "favorites.remove",
          label: "Remove from Favorites",
          commandId: "favorites.removeCurrentResource",
          args: { favoriteId: favorite.id },
        },
      ],
    })),
  };
};

const buildSavedViewsSection = async (ctx: WorkbenchModuleContributionContext) => {
  const views = await ctx.savedViews.list({
    scope: "project",
    projectId: dataRendererStoryProjectId,
    resourceKind: dataRendererStoryViewKind,
  });
  const nodes = await Promise.all(
    views.map(async (view) => {
      const resource = createSavedViewResource(view);
      const favorited = await ctx.favorites.isFavorited(resource, favoriteScope);
      return {
        id: `view-${view.id}`,
        label: view.name,
        icon: "Table",
        resource,
        contextMenuActions: [
          {
            id: "views.favorite",
            label: favorited ? "Remove from Favorites" : "Add to Favorites",
            run: async () => {
              await ctx.favorites.toggle({ target: resource, ...favoriteScope });
            },
          },
        ],
      };
    }),
  );

  return { id: "views", label: "Views", nodes };
};

export const createDataRendererStoryModule = (): WorkbenchModuleContribution => ({
  id: "data-renderer.story",
  activate(ctx) {
    ctx.resources.registerKind({ kind: savedViewResourceKind, label: "Saved view", icon: "Table" });
    ctx.savedViews.registerKind(savedViewKind);

    ctx.renderers.registerDataRenderer({
      id: dataRendererStoryRendererId,
      title: "Rows",
      resourceKind: dataRendererStoryViewKind,
      tagDefinitions: storyTagDefinitions,
      groupingOptions: storyGroupingOptions,
      orderingOptions: storyOrderingOptions,
      displayPropertyOptions: storyDisplayPropertyOptions,
      filterCategories: storyFilterCategories,
      knownColumnKeys: storyStatusColumns.map((column) => column.id),
      getBoardColumnConfig: (groupKey) =>
        columnConfigById.get(groupKey) ?? { color: "gray", canDragIn: true, canDragOut: true, canCreate: true },
      executeQuery: () => storyRows,
      savedViews: { resourceKind: dataRendererStoryViewKind, scope: "project", projectId: dataRendererStoryProjectId },
    });

    ctx.layout.registerWidget({
      id: dataRendererStoryWidgetId,
      title: "Rows",
      area: "main",
      rendererId: dataRendererStoryRendererId,
      resourceKinds: [savedViewResourceKind],
      singleton: true,
    });

    // Open the widget eagerly so the workspace mounts even before saved views
    // are seeded; saved views switch into the same singleton placement.
    ctx.layout.openWidget(dataRendererStoryWidgetId, { title: "Rows" });

    // Route savedView resource opens into this widget so clicking a saved view
    // in the sidebar (and later, from search) swaps the placement's resource.
    ctx.resources.registerOpener({
      id: "data-renderer.story.savedViewOpener",
      priority: 1000,
      canOpen: (resource) => resource.kind === savedViewResourceKind,
      open: (resource, input) => openSavedViewResource(ctx, resource, input),
    });

    void ensureInitialViews(ctx).then(async (views) => {
      await ensureInitialFavorites(ctx, views);
      ctx.renderers.refresh(treeViewId);
      const initial = views[0];
      if (!initial) return;
      void ctx.resources.openResource(createSavedViewResource(initial));
    });

    ctx.renderers.registerTreeRenderer({
      id: treeViewId,
      title: "Views and favorites",
      defaultExpandedSectionIds: ["favorites", "views"],
      getBody: async () => [await buildFavoritesSection(ctx), await buildSavedViewsSection(ctx)],
      getChildren: () => [],
    });

    ctx.layout.registerWidget({
      id: treeViewId,
      title: "Views and favorites",
      area: "left",
      rendererId: treeViewId,
    });
    ctx.layout.openWidget(treeViewId);

    return [
      ctx.savedViews.onDidChange(() => ctx.renderers.refresh(treeViewId)),
      ctx.favorites.onDidChange(() => ctx.renderers.refresh(treeViewId)),
    ];
  },
});
