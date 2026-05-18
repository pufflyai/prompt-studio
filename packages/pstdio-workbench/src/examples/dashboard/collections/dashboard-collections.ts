import type {
  Disposable,
  ResourceBrowseEntry,
  ResourceRef,
  WorkbenchModuleContributionContext,
  WorkbenchSavedView,
} from "../../../core";
import {
  dashboardResources,
  dashboardStatusColumns,
  dashboardTickets,
  dashboardTicketTags,
  dashboardWidgetIds,
} from "../mock-data/data";
import { createSavedViewResource, dashboardCollectionsProjectId } from "./saved-view-resources";
import { createTicketSavedViewKind } from "./ticket-saved-view-kind";
import { filtersToExpression, settingsToDisplay } from "./ticket-view-mapping";

export const dashboardCollectionsTreeViewId = "dashboard-workbench.collections";

const initialViews = [
  {
    name: "Current workbench tickets",
    filter: { field: "tag:area", operator: "is", value: "workbench" },
    display: settingsToDisplay({
      viewMode: "board",
      columnGrouping: "status",
      rowGrouping: "none",
      ordering: { field: "updated", direction: "desc" },
      displayProperties: ["id", "status", "updated"],
    }),
  },
  {
    name: "Review queue",
    filter: filtersToExpression({ status: ["review"] }),
    display: settingsToDisplay({
      viewMode: "list",
      columnGrouping: "status",
      rowGrouping: "none",
      ordering: { field: "updated", direction: "desc" },
      displayProperties: ["id", "assignee", "updated"],
    }),
  },
] as const;

const initialFavorites = [dashboardResources.tickets] satisfies ResourceRef[];

const openSavedView = async (
  ctx: WorkbenchModuleContributionContext,
  view: WorkbenchSavedView,
  input: { replaceActive?: boolean },
) => {
  if (view.invalid === "kind") {
    ctx.notifications.show({ level: "warning", title: "Saved view kind is no longer registered." });
    return;
  }
  if (view.invalid === "filter" || view.invalid === "display" || view.invalid === "migration") {
    ctx.notifications.show({ level: "warning", title: "Saved view needs attention before it can open." });
    return;
  }

  const resource = createSavedViewResource(view);
  ctx.modes.setActiveMode("project");
  ctx.layout.clearArea("main-left");
  ctx.breadcrumbs.setItems([
    {
      title: "Tickets",
      icon: "KanbanSquare",
      resource: dashboardResources.tickets,
      onClick: () => ctx.resources.openResource(dashboardResources.tickets),
    },
    { title: view.name, icon: "Table", resource },
  ]);

  return ctx.layout.openWidget(dashboardWidgetIds.tickets, {
    resource,
    title: view.name,
    replaceActive: input.replaceActive,
  });
};

const ensureInitialViews = async (ctx: WorkbenchModuleContributionContext) => {
  const existing = await ctx.savedViews.list({
    scope: "project",
    projectId: dashboardCollectionsProjectId,
    resourceKind: "ticket",
  });
  if (existing.length > 0) return;

  for (const view of initialViews) {
    await ctx.savedViews.create({
      ...view,
      resourceKind: "ticket",
      scope: "project",
      projectId: dashboardCollectionsProjectId,
    });
  }
};

const registerSavedViewProvider = (ctx: WorkbenchModuleContributionContext) => {
  let cache: ResourceBrowseEntry[] = [];
  const hydrate = async () => {
    const views = await ctx.savedViews.list({ scope: "project", projectId: dashboardCollectionsProjectId });
    cache = views.map((view) => ({
      resource: createSavedViewResource(view),
      searchText: view.name,
      group: "Saved views",
    }));
  };

  void hydrate();
  const savedViewChangeDisposable = ctx.savedViews.onDidChange(() => {
    void hydrate();
  });

  ctx.resources.registerProvider({
    id: "dashboard-workbench.savedViews",
    kind: "savedView",
    list: (query) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) return cache;
      return cache.filter((entry) => entry.searchText?.toLowerCase().includes(normalizedQuery));
    },
  });

  return savedViewChangeDisposable;
};

const registerSavedViewOpener = (ctx: WorkbenchModuleContributionContext) => {
  ctx.resources.registerOpener({
    id: "dashboard-workbench.savedViewOpener",
    priority: 1200,
    canOpen: (resource: ResourceRef) => resource.kind === "savedView",
    open: async (resource, input) => {
      const view = resource.id ? await ctx.savedViews.get(resource.id) : undefined;
      if (!view) {
        ctx.notifications.show({ level: "warning", title: "This saved view no longer exists." });
        return;
      }
      return openSavedView(ctx, view, input);
    },
  });
};

const buildFavoritesSection = async (ctx: WorkbenchModuleContributionContext) => {
  const favorites = await ctx.favorites.list({ scope: "project", projectId: dashboardCollectionsProjectId });
  const visibleFavorites = favorites.filter(
    (favorite) => ctx.resources.getKind(favorite.target.kind) && favorite.target.metadata?.missing !== true,
  );

  return {
    id: "favorites",
    label: "Favorites",
    nodes: visibleFavorites.map((favorite) => ({
      id: favorite.id,
      label: favorite.label ?? favorite.target.label ?? "Untitled",
      icon: favorite.icon ?? favorite.target.icon ?? "Star",
      resource: favorite.target,
      description: favorite.description,
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
    projectId: dashboardCollectionsProjectId,
    resourceKind: "ticket",
  });
  const visibleViews = views.filter((view) => !view.invalid);

  return {
    id: "views",
    label: "Views",
    nodes: visibleViews.map((view) => ({
      id: view.id,
      label: view.name,
      icon: "Table",
      resource: createSavedViewResource(view),
      contextMenuActions: [
        {
          id: "views.favorite",
          label: "Add to Favorites",
          run: async () => {
            await ctx.favorites.toggle({
              target: createSavedViewResource(view),
              scope: "project",
              projectId: dashboardCollectionsProjectId,
            });
          },
        },
        {
          id: "views.duplicate",
          label: "Duplicate",
          commandId: "savedViews.duplicate",
          args: { viewId: view.id, name: `${view.name} Copy` },
        },
        { id: "views.delete", label: "Delete", commandId: "savedViews.delete", args: { viewId: view.id } },
      ],
    })),
  };
};

export const registerDashboardCollectionsTree = (ctx: WorkbenchModuleContributionContext) => {
  const disposables = [
    ctx.renderers.registerTreeRenderer(
      {
        id: dashboardCollectionsTreeViewId,
        title: "Collections",
        defaultExpandedSectionIds: ["favorites", "views"],
        getBody: async () => [await buildFavoritesSection(ctx), await buildSavedViewsSection(ctx)],
        getChildren: () => [],
      },
      { priority: 50 },
    ),
    ctx.layout.registerWidget(
      {
        id: dashboardCollectionsTreeViewId,
        title: "Collections",
        area: "left",
        rendererId: dashboardCollectionsTreeViewId,
      },
      { priority: 50 },
    ),
    ctx.favorites.onDidChange(() => ctx.renderers.refresh(dashboardCollectionsTreeViewId)),
    ctx.savedViews.onDidChange(() => ctx.renderers.refresh(dashboardCollectionsTreeViewId)),
  ];
  ctx.layout.openWidget(dashboardCollectionsTreeViewId);
  return disposables;
};

const ensureInitialFavorites = async (ctx: WorkbenchModuleContributionContext) => {
  const existing = await ctx.favorites.list({ scope: "project", projectId: dashboardCollectionsProjectId });
  if (existing.length > 0) return;

  for (const target of initialFavorites) {
    await ctx.favorites.add({
      target,
      scope: "project",
      projectId: dashboardCollectionsProjectId,
    });
  }
};

const columnConfigById = new Map(
  dashboardStatusColumns.map((column) => [
    column.id,
    { color: column.color, canDragIn: true, canDragOut: column.id !== "done", canCreate: column.id !== "done" },
  ]),
);

const toDataRow = (ticket: (typeof dashboardTickets)[number]) => ({
  ...ticket,
  title: `${ticket.id} ${ticket.title}`,
});

export const registerDashboardTicketDataRenderer = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerDataRenderer({
    id: dashboardWidgetIds.tickets,
    title: "Tickets",
    resourceKind: "ticket",
    tagDefinitions: dashboardTicketTags,
    knownColumnKeys: dashboardStatusColumns.map((column) => column.id),
    getBoardColumnConfig: (groupKey) =>
      columnConfigById.get(groupKey) ?? { color: "gray", canDragIn: true, canDragOut: true, canCreate: true },
    executeQuery: () => dashboardTickets.map(toDataRow),
    onTicketClick: (row) => {
      const resource = (row as { resource?: ResourceRef }).resource;
      if (resource) void ctx.resources.openResource(resource, { replaceActive: true });
    },
    onCreateTicket: (columnId) => ctx.notifications.show({ level: "info", title: `Create ticket in ${columnId}` }),
    savedViews: { resourceKind: "ticket", scope: "project", projectId: dashboardCollectionsProjectId },
  });
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.tickets,
      title: "Tickets",
      area: "main",
      rendererId: dashboardWidgetIds.tickets,
      resourceKinds: ["savedView"],
      singleton: true,
    },
    { priority: 90 },
  );
};

export const registerDashboardCollections = (ctx: WorkbenchModuleContributionContext) => {
  const disposables: Disposable[] = [];
  ctx.resources.registerKind({ kind: "savedView", label: "Saved view", icon: "Table" });
  ctx.savedViews.registerKind(createTicketSavedViewKind());
  registerSavedViewOpener(ctx);
  registerDashboardTicketDataRenderer(ctx);
  disposables.push(registerSavedViewProvider(ctx));
  void ensureInitialViews(ctx);
  void ensureInitialFavorites(ctx);

  return disposables;
};
