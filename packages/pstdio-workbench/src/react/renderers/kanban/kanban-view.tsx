import { Box, Stack } from "@chakra-ui/react";
import type { ResourceContextAction } from "@pstdio/ui";
import {
  applyKanbanMove,
  KanbanRenderer,
  KanbanRendererSkeleton,
  useKanbanRendererStore,
} from "@pstdio/ui/kanban-renderer";
import { type ReactNode, useSyncExternalStore } from "react";
import type {
  KanbanRendererRow,
  RegisteredKanbanRendererContribution,
  ResourceRef,
  WorkbenchCore,
  WorkbenchPanelInstance,
} from "../../../core";
import { getWorkbenchRenderers, rendererReadKey } from "../../../core";
import { reportUserActionError, runUserAction } from "../../../core/shared/run-user-action";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { useWorkbenchResourceActionResolver } from "../../menus/resource-actions";
import { kanbanPageFields } from "../renderer-page-fields";
import { rendererQueryKey } from "../renderer-query-key";
import { RendererReadNotice } from "../renderer-read-notice";
import { usePageParams } from "../use-page-params";
import { useRendererPages } from "../use-renderer-pages";
import { useRendererRead } from "../use-renderer-read";
import { ViewToolbarActions } from "../view-toolbar-actions";
import { prepareKanbanMove } from "./kanban-move";
import { bindReactKanbanPresentation } from "./kanban-presentation";
import { resolveKanbanRendererStorageKey } from "./kanban-view-storage";
import { useKanbanAttributes } from "./use-kanban-attributes";

interface WorkbenchKanbanViewProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
  contribution: RegisteredKanbanRendererContribution;
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

export const WorkbenchKanbanView = (props: WorkbenchKanbanViewProps) => {
  const { workbench, placement } = props;
  const pageParams = usePageParams(workbench, placement);
  const contribution = bindReactKanbanPresentation(props.contribution);
  const resolveResourceActions = useWorkbenchResourceActionResolver(workbench);
  const attributes = useKanbanAttributes(contribution.attributes);
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

  const settings = useKanbanRendererStore(storageKey, (state) => state.settings, initialState);
  const filter = useKanbanRendererStore(storageKey, (state) => state.filter, initialState);
  const sorts = useKanbanRendererStore(storageKey, (state) => state.sorts, initialState);
  const pages = useRendererPages<KanbanRendererRow>({
    identity: rendererQueryKey([storageKey, settings, filter, sorts, pageParams]),
    scope: storageKey,
    fields: kanbanPageFields(attributes, settings),
    append: true,
  });
  const paged = Boolean(contribution.executePage);

  const read = useRendererRead({
    workbench,
    ownerKey: rendererReadKey(placement),
    queryKey: JSON.stringify([contribution.id, storageKey]),
    // Paged providers apply search before selecting rows; legacy providers keep local search.
    refreshKey: rendererQueryKey([settings, filter, sorts, pageParams, ...(paged ? [pages.request, pages.key] : [])]),

    load: async (signal) => {
      const state = { settings, filter, sorts, pageParams };
      if (contribution.executePage)
        return pages.accept(await contribution.executePage({ ...state, page: pages.request }, signal), signal);
      return { rows: await contribution.executeQuery(state, signal), page: undefined, position: undefined };
    },
    subscribe: (refresh) => {
      const invalidate = () => {
        if (!paged || !pages.reset()) refresh();
      };
      const subscription = contribution.subscribe?.(invalidate);
      const events = getWorkbenchRenderers(workbench).onDidRefreshKanbanRenderer((event) => {
        if (event.kanbanRendererId === contribution.id) invalidate();
      });
      return () => {
        if (typeof subscription === "function") subscription();
        else subscription?.dispose();
        events.dispose();
      };
    },
  });
  const rows = read.value?.rows ?? [];
  const mutate = (...args: Parameters<typeof read.mutate>) =>
    read.mutate(...args).finally(() => {
      if (paged) pages.reset();
    });

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
      retry={() => {
        if (!paged || !pages.reset()) void read.retry();
      }}
    />
  ) : null;

  return (
    <WorkbenchKanbanViewFrame>
      {read.value ? readNotice : null}
      <KanbanRenderer
        page={pages.controls(read.value?.page, read.loading, paged, read.value?.position)}
        itemLabel={
          contribution.resourceKind ? workbench.resources.getKind(contribution.resourceKind)?.label : undefined
        }
        viewsSource={viewsSource}
        rows={rows}
        contentPlaceholder={read.value ? undefined : readNotice}
        storageKey={storageKey}
        attributes={attributes}
        defaultSettings={contribution.defaultSettings}
        defaultFilter={contribution.defaultFilter}
        defaultSorts={contribution.defaultSorts}
        defaultViews={contribution.defaultViews}
        defaultActiveViewId={contribution.defaultActiveViewId}
        emptyTitle={contribution.emptyTitle}
        emptyDescription={contribution.emptyDescription}
        getBoardColumnConfig={contribution.getBoardColumnConfig}
        hideToolbar={contribution.hideToolbar}
        onRowClick={contribution.onRowActivate || rows.some((row) => row.target) ? handleOpenRow : undefined}
        onActionError={(error, action) => reportUserActionError(workbench, action, error)}
        onAttributeChange={
          contribution.onAttributeChange
            ? (rowId, attributeId, value) =>
                mutate(
                  (snapshot) => ({
                    ...snapshot,
                    rows: applyKanbanMove(snapshot.rows, { rowId, attributes: { [attributeId]: value } }),
                  }),
                  () => contribution.onAttributeChange!(rowId, attributeId, value),
                )
            : undefined
        }
        onMove={
          contribution.onMove || contribution.onAttributeChange
            ? (move) => {
                const mutation = prepareKanbanMove(contribution, move);
                return mutate(
                  (value) => ({ ...value, rows: applyKanbanMove(value.rows, mutation.move) }),
                  mutation.save,
                );
              }
            : undefined
        }
        onReorder={
          contribution.onReorder
            ? (rowId, beforeRowId) =>
                mutate(
                  (value) => ({
                    ...value,
                    rows: applyKanbanMove(value.rows, { rowId, attributes: {}, order: { beforeRowId } }),
                  }),
                  () => contribution.onReorder!(rowId, beforeRowId),
                )
            : undefined
        }
        createRow={contribution.createRow}
        onCreateRow={contribution.onCreateRow}
        onColumnAction={
          contribution.onColumnAction
            ? (...args) => runUserAction(workbench, "Column action", () => contribution.onColumnAction!(...args))
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
