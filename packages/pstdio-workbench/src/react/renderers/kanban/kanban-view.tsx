import { Box, Stack } from "@chakra-ui/react";
import { resourceKey } from "@pstdio/sdk/extensions";
import type { ResourceContextAction } from "@pstdio/ui";
import {
  KanbanRenderer,
  type KanbanRendererProps,
  KanbanRendererSkeleton,
  useKanbanRendererStore,
} from "@pstdio/ui/kanban-renderer";
import { type ReactNode, useRef, useSyncExternalStore } from "react";
import type {
  KanbanRendererRow,
  RegisteredKanbanRendererContribution,
  ResourceRef,
  WorkbenchCore,
  WorkbenchPanelInstance,
} from "../../../core";
import { rendererReadKey } from "../../../core";
import { bindKanbanRendererContribution } from "../../../core/registries/renderers/kanban-renderer-binding";
import type { KanbanRendererCreateRequest } from "../../../core/registries/renderers/kanban-renderer-registry";
import { rendererResourceDependency } from "../../../core/registries/renderers/renderer-refresh-key";
import { reportUserActionError, runUserAction } from "../../../core/shared/run-user-action";
import type { BoardCreationIntent } from "../../../extensions/host/workbench-create-operation";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { useWorkbenchResourceActionResolver } from "../../menus/resource-actions";
import { useOperationAuthority } from "../../shared/use-operation-authority";
import { projectBoardRows } from "../collection-operation-projection";
import { kanbanPageFields, kanbanSearchFields, rendererPagePresentation } from "../renderer-page-fields";
import { rendererQueryKey } from "../renderer-query-key";
import { RendererReadNotice } from "../renderer-read-notice";
import { shareEqualValue } from "../share-equal-value";
import { useCollectionOperations } from "../use-collection-operations";
import { usePageParams } from "../use-page-params";
import { useRendererPages } from "../use-renderer-pages";
import { useRendererRead } from "../use-renderer-read";
import { useRendererViews } from "../use-renderer-views";
import { ViewToolbarActions } from "../view-toolbar-actions";
import { prepareKanbanMove } from "./kanban-move";
import type { ReactRegisteredKanbanRendererContribution } from "./kanban-presentation";
import { loadKanbanRows, resolveKanbanQueryPresentation } from "./kanban-query-result";
import { resolveKanbanRendererStorageKey } from "./kanban-view-storage";
import { useKanbanAttributes } from "./use-kanban-attributes";
import { useKanbanPageAttributes } from "./use-kanban-page-attributes";

interface WorkbenchKanbanViewProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
  contribution: RegisteredKanbanRendererContribution;
  Renderer?: import("react").ComponentType<KanbanRendererProps>;
  resolveSettings?: (
    settings: import("../../../core").KanbanRendererSettings,
  ) => import("../../../core").KanbanRendererSettings;
  placement: WorkbenchPanelInstance;
}

interface WorkbenchKanbanViewFrameProps {
  children: ReactNode;
}

// Board columns and the list own vertical scrolling, so the renderer always gets a bounded height.
// The workbench region's outer ScrollArea must not become the scroll owner, or the list mounts every row.
const WorkbenchKanbanViewFrame = (props: WorkbenchKanbanViewFrameProps) => {
  const { children } = props;

  return (
    <Stack h="full" minH="0" gap="0" bg="bg" overflow="hidden" position="relative">
      <Box position="absolute" inset="0" minH="0" minW="0" overflow="hidden" display="flex" flexDirection="column">
        {children}
      </Box>
    </Stack>
  );
};

const emptyRows: KanbanRendererRow[] = [];
const noopSubscribe = () => () => {};

export const isKanbanRowResource = (resource: unknown): resource is ResourceRef =>
  Boolean(
    resource &&
      typeof resource === "object" &&
      "type" in resource &&
      typeof resource.type === "string" &&
      "id" in resource &&
      typeof resource.id === "string",
  );

export const mergeKanbanViewRowActions = (
  resourceActions: ResourceContextAction[],
  contributionActions: ResourceContextAction[],
) => {
  const resourceActionKeys = new Set(resourceActions.map((action) => action.key));
  const resourceCommandIds = new Set(resourceActions.flatMap((action) => (action.commandId ? [action.commandId] : [])));
  return [
    ...resourceActions,
    ...contributionActions.filter(
      (action) =>
        !resourceActionKeys.has(action.key) && (!action.commandId || !resourceCommandIds.has(action.commandId)),
    ),
  ];
};

const resolveViewSettings = (
  props: WorkbenchKanbanViewProps,
  settings: import("../../../core").KanbanRendererSettings,
) => (props.resolveSettings ? props.resolveSettings(settings) : settings);

const hasKanbanRowTarget = (row: KanbanRendererRow): boolean =>
  Boolean(row.target || row.children?.some(hasKanbanRowTarget));

const createRowWithRefreshHold = (
  createRow: RegisteredKanbanRendererContribution["onCreateRow"],
  holdRefresh: () => (() => void) | undefined,
  context: Pick<KanbanRendererCreateRequest, "originatingRead"> & {
    canOpenCreatedRow(): KanbanRendererCreateRequest["canOpenCreatedRow"];
  },
): KanbanRendererProps["onCreateRow"] => {
  if (!createRow) return undefined;
  return async (submission) => {
    const release = submission.openCreatedRow === false ? undefined : holdRefresh();
    try {
      await createRow({
        ...submission,
        originatingRead: context.originatingRead,
        canOpenCreatedRow: context.canOpenCreatedRow(),
      });
    } finally {
      release?.();
    }
  };
};

export const WorkbenchKanbanView = (props: WorkbenchKanbanViewProps) => {
  const { workbench, placement, Renderer = KanbanRenderer } = props;
  const createDraftAuthority = useOperationAuthority(workbench);
  const pageParams = usePageParams(workbench, placement);
  // Queries, writes and metadata belong to this placement's resource, not to the page routed in Main.
  const contribution = bindKanbanRendererContribution(props.contribution as ReactRegisteredKanbanRendererContribution, {
    instanceId: placement.instanceId,
    resource: placement.resource,
  });
  const resolveResourceActions = useWorkbenchResourceActionResolver(workbench);
  const declaredAttributes = useKanbanAttributes(contribution.attributes);
  const storageKey = resolveKanbanRendererStorageKey(contribution.id, placement, contribution.storageScope);
  const provider = contribution.viewsProvider;
  const viewsSource = useSyncExternalStore(
    provider?.subscribe ?? noopSubscribe,
    provider?.getSnapshot ?? (() => undefined),
    provider?.getSnapshot ?? (() => undefined),
  );
  const initialState = {
    settings: contribution.defaultSettings,
    filter: contribution.defaultFilter,
    sorts: contribution.defaultSorts,
  };

  const storedSettings = useKanbanRendererStore(storageKey, (state) => state.settings, initialState);
  const settings = resolveViewSettings(props, storedSettings);
  const filter = useKanbanRendererStore(storageKey, (state) => state.filter, initialState);
  const sorts = useKanbanRendererStore(storageKey, (state) => state.sorts, initialState);
  const views = useRendererViews(
    {
      storageKey,
      initialState: { settings: storedSettings, filter: contribution.defaultFilter, sorts: contribution.defaultSorts },
      viewsSource,
      defaultViews: contribution.defaultViews,
      defaultActiveViewId: contribution.defaultActiveViewId,
    },
    provider,
  );
  const pageAttributes = useKanbanPageAttributes(
    rendererQueryKey([contribution.id, contribution.queryScope, resourceKey(placement.resource)]),
    declaredAttributes,
  );
  const pages = useRendererPages<KanbanRendererRow>({
    identity: rendererQueryKey([contribution.id, resourceKey(placement.resource), settings, filter, sorts, pageParams]),
    scope: storageKey,
    fields: kanbanPageFields(pageAttributes.attributes, settings),
    searchFields: kanbanSearchFields(settings),
    presentation: rendererPagePresentation(pageAttributes.attributes),
    initialPageSize: contribution.initialPageSize,
    rowId: (row) => row.id,
  });
  const paged = Boolean(contribution.executePage);
  // The last board a load produced, for the next load to compare against. Written by the load itself,
  // so overlapping reads see it before React renders it.
  const lastLoaded = useRef<unknown>(undefined);

  const query = {
    sourceId: contribution.id,
    queryScope: contribution.queryScope,
    queryKey: rendererQueryKey([contribution.id, resourceKey(placement.resource)]),
    dependency: rendererResourceDependency(placement.resource),
    refreshKey: rendererQueryKey([settings, filter, sorts, pageParams, ...(paged ? [pages.refreshKey] : [])]),
  };
  const read = useRendererRead<Awaited<ReturnType<typeof loadKanbanRows>>>({
    ...query,
    enabled: views.ready,
    workbench,
    ownerKey: rendererReadKey(placement),
    queryEvents: contribution.queryEvents,
    onAccept: pages.accept,
    onInvalidate: pages.reset,
    load: async (signal, _publish, accepted) => {
      const state = { settings, filter, sorts, pageParams, resource: placement.resource };
      const loaded = await loadKanbanRows(contribution, state, pages, signal, accepted);
      // Rows equal to the last loaded board keep their objects, so a reload that changed nothing,
      // such as returning to the page, renders no cards again.
      const shared = shareEqualValue(lastLoaded.current, loaded);
      lastLoaded.current = shared;
      return shared;
    },
    subscribe: contribution.subscribe,
  });
  const acceptedRows = read.acceptedValue?.rows ?? emptyRows;
  const mutations = useCollectionOperations(workbench, query, acceptedRows);
  const rows = projectBoardRows(acceptedRows, mutations.pending, contribution.id, query.queryScope?.projectId);
  const pendingCreations = mutations.pending.flatMap((entry) => {
    if (entry.domain !== "resource.create" || !entry.intent || entry.projectId !== query.queryScope?.projectId)
      return [];
    const intent = entry.intent as BoardCreationIntent;
    if (intent.viewKey !== mutations.originatingRead.key || rows.some(({ id }) => id === intent.confirmedId)) return [];
    return [{ key: entry.id, columnId: intent.columnId, title: intent.title, unconfirmed: entry.status === "unknown" }];
  });
  const presentation = resolveKanbanQueryPresentation(contribution, read.value, declaredAttributes);
  pageAttributes.accept(read.value?.attributes, paged);
  // Use the read's and pages' own functions, not the `read` and `pages` objects, which change on
  // every load step. Row callbacks that change rebuild every card on the board.
  const { mutate, holdRefresh } = read;

  const handleOpenRow = (row: KanbanRendererRow) => {
    if (row.target) {
      void runUserAction(workbench, "Open row", () => workbench.navigation.openTarget(row.target!));
      return;
    }
    if (contribution.onRowActivate) void runUserAction(workbench, "Open row", () => contribution.onRowActivate!(row));
  };

  const getRowContextMenuActions = (row: KanbanRendererRow) => {
    const resourceActions = isKanbanRowResource(row.resource) ? resolveResourceActions(row.resource) : [];
    const contributionActions = (contribution.getRowContextMenuActions?.(row) ?? []).map((action) => ({
      ...action,
      onClick: () => runUserAction(workbench, action.label, () => action.onClick?.()),
    }));
    return mergeKanbanViewRowActions(resourceActions, contributionActions);
  };
  // Tabs, filter pills, and columns read their labels from the views and the query's fields.
  // Until both arrive, show the view's shape instead of controls that would print raw ids.
  if ((provider && !viewsSource) || (!read.value && !read.error)) {
    return (
      <WorkbenchKanbanViewFrame>
        <KanbanRendererSkeleton viewMode={settings.viewMode} />
      </WorkbenchKanbanViewFrame>
    );
  }

  const readNotice = read.error ? (
    <RendererReadNotice
      error={read.error}
      initial={!read.value}
      retry={() => {
        if (!paged || !pages.reset()) void read.retry();
      }}
    />
  ) : null;

  return (
    <WorkbenchKanbanViewFrame>
      {read.value ? readNotice : null}
      <Renderer
        page={pages.controls(read.value?.page, read.loading, paged, read.value?.position)}
        itemLabel={
          contribution.resourceKind ? workbench.resources.getKind(contribution.resourceKind)?.label : undefined
        }
        viewsSource={viewsSource}
        rows={rows}
        contentPlaceholder={read.value ? undefined : readNotice}
        storageKey={storageKey}
        attributes={presentation.attributes}
        defaultSettings={contribution.defaultSettings}
        defaultFilter={contribution.defaultFilter}
        defaultSorts={contribution.defaultSorts}
        defaultViews={contribution.defaultViews}
        defaultActiveViewId={contribution.defaultActiveViewId}
        emptyTitle={contribution.emptyTitle}
        emptyDescription={contribution.emptyDescription}
        getBoardColumnConfig={presentation.getBoardColumnConfig}
        hideToolbar={contribution.hideToolbar}
        onRowClick={contribution.onRowActivate || rows.some(hasKanbanRowTarget) ? handleOpenRow : undefined}
        onActionError={(error, action) => reportUserActionError(workbench, action, error)}
        onAttributeChange={
          contribution.onAttributeChange
            ? (rowId, attributeId, value) =>
                mutations.submit({ rowId, attributes: { [attributeId]: value } }, () =>
                  contribution.onAttributeChange!(rowId, attributeId, value),
                )
            : undefined
        }
        onMove={
          contribution.onMove || contribution.onAttributeChange
            ? (move) => {
                const mutation = prepareKanbanMove(contribution, move);
                return mutations.submit(mutation.move, mutation.save);
              }
            : undefined
        }
        onReorder={
          contribution.onReorder
            ? (rowId, beforeRowId) =>
                mutations.submit({ rowId, attributes: {}, order: { beforeRowId } }, () =>
                  contribution.onReorder!(rowId, beforeRowId),
                )
            : undefined
        }
        createRow={contribution.createRow}
        createDraftAuthority={createDraftAuthority}
        pendingCreations={pendingCreations}
        onCreateRow={createRowWithRefreshHold(contribution.onCreateRow, holdRefresh, {
          originatingRead: mutations.originatingRead,
          canOpenCreatedRow: () => workbench.viewers.captureContext(placement.placementIdentity).isViewerCurrent,
        })}
        onColumnAction={
          contribution.onColumnAction
            ? (...args) =>
                runUserAction(workbench, "Column action", () =>
                  mutate(
                    (snapshot) => snapshot,
                    () => contribution.onColumnAction!(...args),
                  ),
                )
            : undefined
        }
        getRowContextMenuActions={getRowContextMenuActions}
        toolbarActions={
          <ViewToolbarActions
            workbench={workbench}
            actions={contribution.toolbarActions}
            context={{ resource: placement.resource }}
            renderParamField={props.renderParamField}
          />
        }
      />
    </WorkbenchKanbanViewFrame>
  );
};
