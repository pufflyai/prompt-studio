import { Box, Stack } from "@chakra-ui/react";
import { type ResourceContextAction, ScrollArea } from "@pstdio/ui";
import {
  type AttributeDescriptor,
  type AttributesSource,
  isAttributesSource,
  KanbanRenderer,
  type KanbanRendererRow,
  useKanbanRendererStore,
} from "@pstdio/ui/kanban-renderer";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  KanbanRendererQueryState,
  RegisteredKanbanRendererContribution,
  ResourceRef,
  WorkbenchCore,
  WorkbenchPanelInstance,
} from "../../../core";
import { useWorkbenchResourceActionResolver } from "../../menus/resource-actions";
import { createKanbanViewQuerySequencer, executeKanbanViewQuery } from "./kanban-view-query";
import { resolveKanbanRendererStorageKey } from "./kanban-view-storage";

interface WorkbenchKanbanViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredKanbanRendererContribution;
  placement: WorkbenchPanelInstance;
}

interface WorkbenchKanbanViewFrameProps {
  children: ReactNode;
  usesInternalScroll: boolean;
}

const kanbanViewScrollContentProps = { display: "flex", flexDirection: "column", minH: "100%" } as const;

const WorkbenchKanbanViewFrame = (props: WorkbenchKanbanViewFrameProps) => {
  const { children, usesInternalScroll } = props;

  return (
    <Stack h="full" minH="0" gap="0" bg="bg" overflow="hidden" position={usesInternalScroll ? "relative" : undefined}>
      {usesInternalScroll ? (
        // Board columns own vertical scrolling; do not let their content height
        // make the workbench region's outer ScrollArea become the scroll owner.
        <Box position="absolute" inset="0" minH="0" minW="0" overflow="hidden">
          {children}
        </Box>
      ) : (
        <ScrollArea flex="1" minH="0" minW="0" w="full" size="xs" contentProps={kanbanViewScrollContentProps}>
          {children}
        </ScrollArea>
      )}
    </Stack>
  );
};

const noopSubscribe = () => () => {};

const isResourceRef = (resource: unknown): resource is ResourceRef =>
  Boolean(
    resource &&
      typeof resource === "object" &&
      typeof (resource as { kind?: unknown }).kind === "string" &&
      typeof (resource as { uri?: unknown }).uri === "string",
  );

const useResolvedContributionAttributes = (attributes: AttributeDescriptor[] | AttributesSource) => {
  const source = isAttributesSource(attributes) ? attributes : undefined;
  const fallback = source ? undefined : (attributes as AttributeDescriptor[]);
  const subscribe = source ? source.subscribe : noopSubscribe;
  const getSnapshot = source ? source.getSnapshot : () => fallback!;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

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
  const { workbench, contribution, placement } = props;
  const resolveResourceActions = useWorkbenchResourceActionResolver(workbench);
  const attributes = useResolvedContributionAttributes(contribution.attributes);
  const storageKey = resolveKanbanRendererStorageKey(contribution.id, placement);
  const initialState = {
    settings: contribution.defaultSettings,
    filters: contribution.defaultFilters,
    views: contribution.defaultViews,
    activeViewId: contribution.defaultActiveViewId,
  };

  const settings = useKanbanRendererStore(storageKey, (state) => state.settings, initialState);
  const filters = useKanbanRendererStore(storageKey, (state) => state.filters, initialState);

  const [rows, setRows] = useState<KanbanRendererRow[]>([]);
  const querySequencer = useRef(createKanbanViewQuerySequencer());

  // Run executeQuery whenever settings/filters change.
  useEffect(() => {
    let cancelled = false;
    const runQuery = () => {
      const queryId = querySequencer.current.next();
      const state: KanbanRendererQueryState = { settings, filters };
      void executeKanbanViewQuery(() => contribution.executeQuery(state)).then((next) => {
        if (cancelled || !querySequencer.current.isLatest(queryId)) return;
        setRows(next);
      });
    };
    runQuery();

    const subscription = contribution.subscribe?.(runQuery);
    const refreshSubscription = workbench.renderers.onDidRefreshKanbanRenderer((event) => {
      if (event.kanbanRendererId === contribution.id) runQuery();
    });
    return () => {
      cancelled = true;
      if (typeof subscription === "function") {
        subscription();
      } else {
        subscription?.dispose();
      }
      refreshSubscription.dispose();
    };
  }, [contribution, filters, settings, workbench]);

  const handleOpenRow = (row: KanbanRendererRow) => {
    if (contribution.onRowActivate) void Promise.resolve(contribution.onRowActivate(row)).catch(() => undefined);
  };

  const getRowContextMenuActions = (row: KanbanRendererRow) => {
    const resourceActions = isResourceRef(row.resource) ? resolveResourceActions(row.resource) : [];
    const contributionActions = contribution.getRowContextMenuActions?.(row) ?? [];
    return mergeKanbanViewRowActions(resourceActions, contributionActions);
  };

  return (
    <WorkbenchKanbanViewFrame usesInternalScroll={settings.viewMode === "board"}>
      <KanbanRenderer
        rows={rows}
        storageKey={storageKey}
        attributes={attributes}
        defaultSettings={contribution.defaultSettings}
        defaultFilters={contribution.defaultFilters}
        defaultViews={contribution.defaultViews}
        defaultActiveViewId={contribution.defaultActiveViewId}
        emptyTitle={contribution.emptyTitle}
        emptyDescription={contribution.emptyDescription}
        getBoardColumnConfig={contribution.getBoardColumnConfig}
        hideToolbar={contribution.hideToolbar}
        onRowClick={contribution.onRowActivate ? handleOpenRow : undefined}
        onAttributeChange={contribution.onAttributeChange}
        onReorder={contribution.onReorder}
        createRow={contribution.createRow}
        onCreateRow={contribution.onCreateRow}
        onColumnAction={contribution.onColumnAction}
        getRowContextMenuActions={getRowContextMenuActions}
      />
    </WorkbenchKanbanViewFrame>
  );
};
