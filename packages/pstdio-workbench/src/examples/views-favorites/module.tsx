import { Badge, Box, Button, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  createWorkbenchCore,
  type FilterExpression,
  type ResourceRef,
  type SavedViewKindContribution,
  type ViewDisplayOptions,
  type WorkbenchModuleContribution,
  type WorkbenchModuleContributionContext,
  type WorkbenchSavedView,
  type WorkbenchWidgetRenderInput,
} from "../../core";
import { WorkbenchIcon } from "../../react";

const projectId = "views-favorites-project";
const favoriteScope = { scope: "project", projectId } as const;
const savedViewResourceKind = "savedView";
const viewResourceKind = "views-favorites.ticket";
const mainWidgetId = "views-favorites.main";
const mainRendererId = "views-favorites.main-renderer";
const treeViewId = "views-favorites.tree";

const createSavedViewResource = (view: WorkbenchSavedView): ResourceRef => ({
  kind: savedViewResourceKind,
  id: view.id,
  uri: `views-favorites://saved-view/${view.id}`,
  label: view.name,
  icon: "Table",
  metadata: {
    favoriteScope,
    filter: view.filter,
    display: view.display,
  },
});

const filters = {
  all: { field: "status", operator: "in", value: ["backlog", "review", "done"] },
  review: { field: "status", operator: "is", value: "review" },
  mine: { field: "assignee", operator: "is", value: "Aure" },
} satisfies Record<string, FilterExpression>;

const displays = {
  list: { layout: "list", columns: ["id", "status", "assignee"], sort: [{ field: "updated", direction: "desc" }] },
  board: { layout: "board", columns: ["id", "status"], groupBy: ["status"] },
} satisfies Record<string, ViewDisplayOptions>;

const initialViews = [
  { name: "All work", filter: filters.all, display: displays.list },
  { name: "Review queue", filter: filters.review, display: displays.board },
  { name: "Assigned to me", filter: filters.mine, display: displays.list },
] as const;

const viewKind = {
  kind: viewResourceKind,
  label: "Ticket view",
  icon: "Table",
  fields: [
    { id: "id", label: "ID", type: "string", operators: ["is", "in"] },
    { id: "status", label: "Status", type: "enum", operators: ["is", "in"] },
    { id: "assignee", label: "Assignee", type: "user", operators: ["is", "in"] },
    { id: "updated", label: "Updated", type: "date", operators: ["before", "after"] },
  ],
  layouts: ["list", "board", "table"],
  defaultDisplay: displays.list,
  resolveQuery: async () => ({ rows: [] }),
  createResource: createSavedViewResource,
} satisfies SavedViewKindContribution;

const ensureInitialViews = async (ctx: WorkbenchModuleContributionContext) => {
  const existing = await ctx.savedViews.list({ scope: "project", projectId, resourceKind: viewResourceKind });
  if (existing.length > 0) return existing;

  const created: WorkbenchSavedView[] = [];
  for (const [order, view] of initialViews.entries()) {
    created.push(
      await ctx.savedViews.create({
        ...view,
        order,
        resourceKind: viewResourceKind,
        scope: "project",
        projectId,
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

const openSavedView = async (
  ctx: WorkbenchModuleContributionContext,
  resource: ResourceRef,
  input: { replaceActive?: boolean },
) => {
  const view = resource.id ? await ctx.savedViews.get(resource.id) : undefined;
  const activeResource = view ? createSavedViewResource(view) : resource;
  ctx.breadcrumbs.setItems([
    { title: activeResource.label ?? "View", icon: activeResource.icon, resource: activeResource },
  ]);
  return ctx.layout.openWidget(mainWidgetId, {
    resource: activeResource,
    title: activeResource.label,
    replaceActive: input.replaceActive,
  });
};

const registerResources = (ctx: WorkbenchModuleContributionContext) => {
  ctx.resources.registerKind({ kind: savedViewResourceKind, label: "Saved view", icon: "Table" });
  ctx.savedViews.registerKind(viewKind);
  ctx.resources.registerProvider({
    id: "views-favorites.saved-views",
    kind: savedViewResourceKind,
    list: () => [],
  });
  ctx.resources.registerOpener({
    id: "views-favorites.saved-view-opener",
    canOpen: (resource) => resource.kind === savedViewResourceKind,
    open: (resource, input) => openSavedView(ctx, resource, input),
  });
};

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

const buildViewsSection = async (ctx: WorkbenchModuleContributionContext) => {
  const views = await ctx.savedViews.list({ scope: "project", projectId, resourceKind: viewResourceKind });

  return {
    id: "views",
    label: "Views",
    nodes: views.map((view) => {
      const resource = createSavedViewResource(view);
      return {
        id: view.id,
        label: view.name,
        icon: "Table",
        resource,
        contextMenuActions: [
          {
            id: "views.favorite",
            label: "Add to Favorites",
            run: async () => {
              await ctx.favorites.toggle({ target: resource, ...favoriteScope });
            },
          },
        ],
      };
    }),
  };
};

const registerTree = (ctx: WorkbenchModuleContributionContext) => {
  const disposables = [
    ctx.renderers.registerTreeRenderer({
      id: treeViewId,
      title: "Views and favorites",
      defaultExpandedSectionIds: ["favorites", "views"],
      getBody: async () => [await buildFavoritesSection(ctx), await buildViewsSection(ctx)],
      getChildren: () => [],
    }),
    ctx.layout.registerWidget({
      id: treeViewId,
      title: "Views and favorites",
      area: "left",
      rendererId: treeViewId,
    }),
    ctx.favorites.onDidChange(() => ctx.renderers.refresh(treeViewId)),
    ctx.savedViews.onDidChange(() => ctx.renderers.refresh(treeViewId)),
  ];
  ctx.layout.openWidget(treeViewId);
  return disposables;
};

const getViewDisplayLabel = (resource: ResourceRef | undefined) => {
  const display = resource?.metadata?.display as ViewDisplayOptions | undefined;
  if (!display) return "view";
  return display.layout;
};

const ActiveViewPanel = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const resource = input.placement.resource;
  const [isFavorite, setIsFavorite] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);

  useEffect(() => {
    let disposed = false;

    const sync = () => {
      void input.workbench.savedViews
        .list({ scope: "project", projectId, resourceKind: viewResourceKind })
        .then((views) => {
          if (!disposed) setViewCount(views.length);
        });
      void input.workbench.favorites.list(favoriteScope).then((favorites) => {
        if (!disposed) setFavoriteCount(favorites.length);
      });
      if (!resource) {
        setIsFavorite(false);
        return;
      }
      void input.workbench.favorites.isFavorited(resource, favoriteScope).then((favorited) => {
        if (!disposed) setIsFavorite(favorited);
      });
    };

    sync();
    const favoriteDisposable = input.workbench.favorites.onDidChange(sync);
    const savedViewDisposable = input.workbench.savedViews.onDidChange(sync);
    return () => {
      disposed = true;
      favoriteDisposable.dispose();
      savedViewDisposable.dispose();
    };
  }, [input.workbench, resource]);

  const toggleFavorite = () => {
    if (!resource) return;
    void input.workbench.favorites.toggle({ target: resource, ...favoriteScope });
  };

  return (
    <Stack gap="lg" h="full" minH="0" overflow="auto" p="lg">
      <HStack gap="sm" wrap="wrap">
        <Badge colorPalette="blue">{viewCount} views</Badge>
        <Badge colorPalette="yellow">{favoriteCount} favorites</Badge>
        <Badge colorPalette={isFavorite ? "green" : "gray"}>{isFavorite ? "favorite" : "not favorite"}</Badge>
      </HStack>

      <Stack gap="xs">
        <HStack gap="sm" minW="0">
          <WorkbenchIcon name={resource?.icon ?? "Table"} size={22} />
          <Text as="h1" textStyle="title/M/semibold" truncate>
            {resource?.label ?? "No view"}
          </Text>
        </HStack>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {getViewDisplayLabel(resource)}
        </Text>
      </Stack>

      <HStack gap="sm" wrap="wrap">
        <Button size="sm" onClick={toggleFavorite}>
          <WorkbenchIcon name={isFavorite ? "StarOff" : "Star"} />
          {isFavorite ? "Remove favorite" : "Add favorite"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => input.workbench.commandPalette.open()}>
          <WorkbenchIcon name="Command" />
          Command palette
        </Button>
      </HStack>

      <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap="md">
        <Box borderWidth="1px" borderColor="border.muted" p="md">
          <Text textStyle="label/S/semibold">Filter</Text>
          <Text as="pre" fontFamily="mono" fontSize="xs" mt="sm" overflow="auto" whiteSpace="pre-wrap">
            {JSON.stringify(resource?.metadata?.filter ?? {}, null, 2)}
          </Text>
        </Box>
        <Box borderWidth="1px" borderColor="border.muted" p="md">
          <Text textStyle="label/S/semibold">Display</Text>
          <Text as="pre" fontFamily="mono" fontSize="xs" mt="sm" overflow="auto" whiteSpace="pre-wrap">
            {JSON.stringify(resource?.metadata?.display ?? {}, null, 2)}
          </Text>
        </Box>
      </Grid>
    </Stack>
  );
};

const registerMain = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({ id: mainWidgetId, title: "View", area: "main", rendererId: mainRendererId });
  ctx.renderers.registerRenderer({ id: mainRendererId, render: (input) => <ActiveViewPanel input={input} /> });
};

const createViewsFavoritesModule = (): WorkbenchModuleContribution => ({
  id: "views-favorites",
  activate(ctx) {
    registerResources(ctx);
    registerMain(ctx);
    const treeDisposables = registerTree(ctx);

    void ensureInitialViews(ctx).then(async (views) => {
      await ensureInitialFavorites(ctx, views);
      const firstView = views[0];
      if (firstView) await ctx.resources.openResource(createSavedViewResource(firstView), { replaceActive: true });
    });

    return treeDisposables;
  },
});

export const createViewsFavoritesWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.layout.setAreaSize("left", 280);
  workbench.registerModule(createViewsFavoritesModule());
  return workbench;
};
