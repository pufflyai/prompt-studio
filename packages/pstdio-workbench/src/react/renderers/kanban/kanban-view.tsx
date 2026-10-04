import { Box, Skeleton, Stack } from "@chakra-ui/react";
import { type ResourceContextAction, ScrollArea } from "@pstdio/ui";
import {
  type AttributeDescriptor,
  type AttributesSource,
  isAttributesSource,
  KanbanRenderer,
  type KanbanRendererRow,
  useKanbanRendererStore,
} from "@pstdio/ui/kanban-renderer";
import { type ReactNode, useSyncExternalStore } from "react";
import type {
  RegisteredKanbanRendererContribution,
  ResourceRef,
  WorkbenchCore,
  WorkbenchPanelInstance,
} from "../../../core";
import { getWorkbenchRenderers, rendererReadKey } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { useWorkbenchResourceActionResolver } from "../../menus/resource-actions";
import { RendererReadNotice } from "../renderer-read-notice";
import { useRendererRead } from "../use-renderer-read";
import { ViewToolbarActions } from "../view-toolbar-actions";
import { bindReactKanbanPresentation } from "./kanban-presentation";
import { resolveKanbanRendererStorageKey } from "./kanban-view-storage";

interface WorkbenchKanbanViewProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
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

export const isKanbanRowResource = (resource: unknown): resource is ResourceRef =>
  Boolean(
    resource &&
      typeof resource === "object" &&
      "type" in resource &&
      typeof resource.type === "string" &&
      "id" in resource &&
      typeof resource.id === "string",
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
  const { workbench, placement } = props;
  const contribution = bindReactKanbanPresentation(props.contribution);
  const resolveResourceActions = useWorkbenchResourceActionResolver(workbench);
  const attributes = useResolvedContributionAttributes(contribution.attributes);
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

  const read = useRendererRead({
    workbench,
    ownerKey: rendererReadKey(placement),
    queryKey: contribution.id,
    // The view can narrow what the query returns, so it loads again while the board stays on
    // screen. Search is not part of it, so typing a search never runs the query.
    refreshKey: JSON.stringify([settings, filter, sorts]),

    load: (signal) => contribution.executeQuery({ settings, filter, sorts }, signal),
    subscribe: (refresh) => {
      const subscription = contribution.subscribe?.(refresh);
      const events = getWorkbenchRenderers(workbench).onDidRefreshKanbanRenderer((event) => {
        if (event.kanbanRendererId === contribution.id) refresh();
      });
      return () => {
        if (typeof subscription === "function") subscription();
        else subscription?.dispose();
        events.dispose();
      };
    },
  });
  const rows = read.value ?? [];

  const handleOpenRow = (row: KanbanRendererRow) => {
    if (contribution.onRowActivate) void Promise.resolve(contribution.onRowActivate(row)).catch(() => undefined);
  };

  const getRowContextMenuActions = (row: KanbanRendererRow) => {
    const resourceActions = isKanbanRowResource(row.resource) ? resolveResourceActions(row.resource) : [];
    const contributionActions = contribution.getRowContextMenuActions?.(row) ?? [];
    return mergeKanbanViewRowActions(resourceActions, contributionActions);
  };
  const contentPlaceholder = read.error ? (
    <RendererReadNotice error={read.error} retry={read.retry} />
  ) : (
    <Skeleton minH="12rem" w="full" />
  );

  const readNotice = read.error && read.value ? <RendererReadNotice error={read.error} retry={read.retry} /> : null;
  if (provider && !viewsSource) {
    return (
      <WorkbenchKanbanViewFrame usesInternalScroll={settings.viewMode === "board"}>
        {readNotice}
        <Skeleton minH="12rem" w="full" />
      </WorkbenchKanbanViewFrame>
    );
  }

  return (
    <WorkbenchKanbanViewFrame usesInternalScroll={settings.viewMode === "board"}>
      {readNotice}
      <KanbanRenderer
        itemLabel={
          contribution.resourceKind ? workbench.resources.getKind(contribution.resourceKind)?.label : undefined
        }
        viewsSource={viewsSource}
        rows={rows}
        contentPlaceholder={read.value ? undefined : contentPlaceholder}
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
        onRowClick={contribution.onRowActivate ? handleOpenRow : undefined}
        onAttributeChange={contribution.onAttributeChange}
        onReorder={contribution.onReorder}
        createRow={contribution.createRow}
        onCreateRow={contribution.onCreateRow}
        onColumnAction={contribution.onColumnAction}
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
