import type {
  ResourceBrowseEntry,
  ResourceRef,
  WorkbenchModuleContributionContext,
  WorkbenchSavedView,
} from "../../../../../core";
import { dashboardCollectionsProjectId, dashboardResources } from "../../../shared/mock-data/resources";
import { dashboardWidgetIds } from "../../../shared/widget-ids";
import { createSavedViewResource } from "./saved-view-resources";
import { createTicketSavedViewKind } from "./ticket-saved-view-kind";
import { filtersToExpression, settingsToDisplay } from "./ticket-view-mapping";

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

const ensureInitialFavorites = async (ctx: WorkbenchModuleContributionContext) => {
  const existing = await ctx.favorites.list({ scope: "project", projectId: dashboardCollectionsProjectId });
  if (existing.length > 0) return;

  for (const target of initialFavorites) {
    await ctx.favorites.add({ target, scope: "project", projectId: dashboardCollectionsProjectId });
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
  ctx.savedViews.onDidChange(() => {
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

export const buildFavoritesSection = async (ctx: WorkbenchModuleContributionContext) => {
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

export const buildSavedViewsSection = async (ctx: WorkbenchModuleContributionContext) => {
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

// Registers the ticket saved-view kind, its opener and search provider, then
// seeds the project's starter views and favorites.
export const registerTicketSavedViews = (ctx: WorkbenchModuleContributionContext) => {
  ctx.savedViews.registerKind(createTicketSavedViewKind());
  registerSavedViewOpener(ctx);
  registerSavedViewProvider(ctx);
  void ensureInitialViews(ctx);
  void ensureInitialFavorites(ctx);
};
