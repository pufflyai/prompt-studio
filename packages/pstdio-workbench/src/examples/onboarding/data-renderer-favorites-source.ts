export const dataRendererFavoritesSource = `import type {
  ResourceRef,
  SavedViewKindContribution,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
  WorkbenchSavedView,
} from "pstdio-workbench/core";

const projectId = "docs-data-project";
const favoriteScope = { scope: "project", projectId } as const;
const savedViewResourceKind = "savedView";
const rowResourceKind = "docs.row";
const rowsWidgetId = "docs.rows";
const treeWidgetId = "docs.views";

const rows = [
  { id: "DR-1", title: "Schema-aware grouping", status: "in-progress", assignee: "Aure" },
  { id: "DR-2", title: "Saved-view menu wiring", status: "review", assignee: "Mika" },
];

const createSavedViewResource = (view: WorkbenchSavedView): ResourceRef => ({
  kind: savedViewResourceKind,
  id: view.id,
  uri: "docs://views/" + view.id,
  label: view.name,
  icon: "Table",
  metadata: {
    favoriteScope,
    resourceKind: view.resourceKind,
    filter: view.filter,
    display: view.display,
  },
});

const savedViewKind = {
  kind: rowResourceKind,
  label: "Row view",
  icon: "Table",
  fields: [{ id: "status", label: "Status", type: "enum", operators: ["is", "in"] }],
  layouts: ["list", "board", "table"],
  defaultDisplay: { layout: "board", columns: ["id", "status"], groupBy: ["status"] },
  resolveQuery: async () => ({ rows }),
  createResource: createSavedViewResource,
} satisfies SavedViewKindContribution;

const seedViewsAndFavorites = async (ctx: WorkbenchModuleContributionContext) => {
  const views = await Promise.all([
    ctx.savedViews.create({
      name: "Active board",
      resourceKind: rowResourceKind,
      scope: "project",
      projectId,
      filter: { field: "status", operator: "in", value: ["in-progress", "review"] },
      display: { layout: "board", columns: ["id", "status"], groupBy: ["status"] },
    }),
    ctx.savedViews.create({
      name: "Review queue",
      resourceKind: rowResourceKind,
      scope: "project",
      projectId,
      filter: { field: "status", operator: "is", value: "review" },
      display: { layout: "list", columns: ["id", "status"] },
    }),
  ]);

  await ctx.favorites.add({ target: createSavedViewResource(views[0]), ...favoriteScope });
  await ctx.resources.openResource(createSavedViewResource(views[0]), { replaceActive: true });
};

const openSavedView = async (
  ctx: WorkbenchModuleContributionContext,
  resource: ResourceRef,
  input: { replaceActive?: boolean },
) => {
  const view = resource.id ? await ctx.savedViews.get(resource.id) : undefined;
  const activeResource = view ? createSavedViewResource(view) : resource;
  return ctx.layout.openWidget(rowsWidgetId, {
    resource: activeResource,
    title: activeResource.label,
    replaceActive: input.replaceActive,
  });
};

const buildTreeBody = async (ctx: WorkbenchModuleContributionContext) => {
  const favorites = await ctx.favorites.list(favoriteScope);
  const views = await ctx.savedViews.list({ scope: "project", projectId, resourceKind: rowResourceKind });

  return [
    {
      id: "favorites",
      label: "Favorites",
      nodes: favorites.map((favorite) => ({
        id: favorite.id,
        label: favorite.label ?? favorite.target.label ?? "Untitled",
        icon: "Star",
        resource: favorite.target,
      })),
    },
    {
      id: "views",
      label: "Views",
      nodes: views.map((view) => ({
        id: view.id,
        label: view.name,
        icon: "Table",
        resource: createSavedViewResource(view),
        contextMenuActions: [
          {
            id: "views.favorite",
            label: "Toggle Favorite",
            run: () => ctx.favorites.toggle({ target: createSavedViewResource(view), ...favoriteScope }),
          },
        ],
      })),
    },
  ];
};

export const createDataRendererFavoritesModule = (): WorkbenchModuleContribution => ({
  id: "docs.data-renderer-favorites",
  activate(ctx) {
    ctx.resources.registerKind({ kind: savedViewResourceKind, label: "Saved view", icon: "Table" });
    ctx.savedViews.registerKind(savedViewKind);

    ctx.renderers.registerDataRenderer({
      id: rowsWidgetId,
      title: "Rows",
      resourceKind: rowResourceKind,
      executeQuery: () => rows,
      savedViews: { resourceKind: rowResourceKind, scope: "project", projectId },
    });
    ctx.layout.registerWidget({
      id: rowsWidgetId,
      title: "Rows",
      area: "main",
      rendererId: rowsWidgetId,
      resourceKinds: [savedViewResourceKind],
      singleton: true,
    });
    ctx.resources.registerOpener({
      id: "docs.saved-view-opener",
      canOpen: (resource) => resource.kind === savedViewResourceKind,
      open: (resource, input) => openSavedView(ctx, resource, input),
    });

    ctx.renderers.registerTreeRenderer({
      id: treeWidgetId,
      title: "Views and favorites",
      defaultExpandedSectionIds: ["favorites", "views"],
      getBody: () => buildTreeBody(ctx),
      getChildren: () => [],
    });
    ctx.layout.registerWidget({ id: treeWidgetId, title: "Views and favorites", area: "left", rendererId: treeWidgetId });
    ctx.layout.openWidget(treeWidgetId);
    ctx.layout.openWidget(rowsWidgetId);

    void seedViewsAndFavorites(ctx).then(() => ctx.renderers.refresh(treeWidgetId));
    return [
      ctx.savedViews.onDidChange(() => ctx.renderers.refresh(treeWidgetId)),
      ctx.favorites.onDidChange(() => ctx.renderers.refresh(treeWidgetId)),
    ];
  },
});`;
