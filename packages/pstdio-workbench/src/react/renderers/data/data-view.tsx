import { Box, Stack } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import {
  type AttributeDescriptor,
  type AttributesSource,
  DataRenderer,
  type DataRendererRow,
  isAttributesSource,
  useDataRendererStore,
} from "@pstdio/ui/data-renderer";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  DataRendererQueryState,
  RegisteredDataRendererContribution,
  WorkbenchCore,
  WorkbenchWidgetPlacement,
} from "../../../core";
import { createDataViewQuerySequencer } from "./data-view-query";
import { resolveDataRendererStorageKey } from "./data-view-storage";

interface WorkbenchDataViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredDataRendererContribution;
  placement: WorkbenchWidgetPlacement;
}

interface WorkbenchDataViewFrameProps {
  children: ReactNode;
  usesInternalScroll: boolean;
}

const dataViewScrollContentProps = { display: "flex", flexDirection: "column", minH: "100%" } as const;

const WorkbenchDataViewFrame = (props: WorkbenchDataViewFrameProps) => {
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
        <ScrollArea flex="1" minH="0" minW="0" w="full" size="xs" contentProps={dataViewScrollContentProps}>
          {children}
        </ScrollArea>
      )}
    </Stack>
  );
};

const noopSubscribe = () => () => {};

const useResolvedContributionAttributes = (attributes: AttributeDescriptor[] | AttributesSource) => {
  const source = isAttributesSource(attributes) ? attributes : undefined;
  const fallback = source ? undefined : (attributes as AttributeDescriptor[]);
  const subscribe = source ? source.subscribe : noopSubscribe;
  const getSnapshot = source ? source.getSnapshot : () => fallback!;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export const WorkbenchDataView = (props: WorkbenchDataViewProps) => {
  const { workbench, contribution, placement } = props;
  const attributes = useResolvedContributionAttributes(contribution.attributes);
  const storageKey = resolveDataRendererStorageKey(contribution.id, placement);
  const initialState = { settings: contribution.defaultSettings, filters: contribution.defaultFilters };

  const settings = useDataRendererStore(storageKey, (state) => state.settings, initialState);
  const filters = useDataRendererStore(storageKey, (state) => state.filters, initialState);

  const [rows, setRows] = useState<DataRendererRow[]>([]);
  const querySequencer = useRef(createDataViewQuerySequencer());

  // Run executeQuery whenever settings/filters change.
  useEffect(() => {
    let cancelled = false;
    const runQuery = () => {
      const queryId = querySequencer.current.next();
      const state: DataRendererQueryState = { settings, filters };
      Promise.resolve(contribution.executeQuery(state)).then((next) => {
        if (cancelled || !querySequencer.current.isLatest(queryId)) return;
        setRows(next);
      });
    };
    runQuery();

    const subscription = contribution.subscribe?.(runQuery);
    const refreshSubscription = workbench.renderers.onDidRefreshDataRenderer((event) => {
      if (event.dataRendererId === contribution.id) runQuery();
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

  const handleOpenRow = (row: DataRendererRow) => {
    if (contribution.onRowClick) {
      contribution.onRowClick(row);
      return;
    }
    const resource = row.resource as Parameters<typeof workbench.resources.openResource>[0] | undefined;
    if (resource && typeof resource === "object" && "kind" in resource && "uri" in resource) {
      void workbench.resources.openResource(resource, { replaceActive: true });
    }
  };

  return (
    <WorkbenchDataViewFrame usesInternalScroll={settings.viewMode === "board"}>
      <DataRenderer
        rows={rows}
        storageKey={storageKey}
        attributes={attributes}
        defaultSettings={contribution.defaultSettings}
        defaultFilters={contribution.defaultFilters}
        emptyTitle={contribution.emptyTitle}
        emptyDescription={contribution.emptyDescription}
        getBoardColumnConfig={contribution.getBoardColumnConfig}
        hideToolbar={contribution.hideToolbar}
        onRowClick={handleOpenRow}
        onAttributeChange={contribution.onAttributeChange}
        onReorder={contribution.onReorder}
        onCreateRow={contribution.onCreateRow}
        onColumnAction={contribution.onColumnAction}
        getRowContextMenuActions={contribution.getRowContextMenuActions}
      />
    </WorkbenchDataViewFrame>
  );
};
