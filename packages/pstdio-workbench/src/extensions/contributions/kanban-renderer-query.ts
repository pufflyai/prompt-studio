import type { KanbanRendererRow as WireRow } from "@pstdio/sdk/extensions";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import type { KanbanRendererQueryState, ResourceRef } from "../../core";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import {
  executeKanbanRendererCommand,
  isQueryResult,
  type KanbanRendererRow,
  type QueryResult,
  toWorkbenchRow,
} from "./kanban-renderer-contribution-helpers";

export const createKanbanRendererQuery = (input: {
  context: WorkbenchExtensionCommandContext;
  record: WorkbenchExtensionKanbanRendererRecord;
  rowResource: (row: KanbanRendererRow) => ResourceRef | undefined;
  onMetadata: (result: QueryResult) => void;
}) => {
  const { context, record, rowResource, onMetadata } = input;
  const originalRows = new WeakMap<KanbanRendererRow, KanbanRendererRow>();
  let latestQueryId = 0;
  let rowCache = new Map<string, { signature: string; row: KanbanRendererRow }>();
  return {
    original: (row: KanbanRendererRow) => originalRows.get(row) ?? row,
    read: async (state: KanbanRendererQueryState, signal: AbortSignal) => {
      const queryId = ++latestQueryId;
      const value = await executeKanbanRendererCommand(
        context,
        record,
        record.queryHandlerId,
        {
          settings: state.settings,
          filter: state.filter,
          sorts: state.sorts,
          ...(state.page && { page: state.page }),
        },
        undefined,
        signal,
        state.pageParams,
      );
      let wireRows: unknown[] = [];
      if (Array.isArray(value)) wireRows = value;
      else if (isQueryResult(value)) wireRows = value.rows ?? [];
      const nextCache = new Map<string, { signature: string; row: KanbanRendererRow }>();
      const rows = wireRows.map((row) => {
        const candidate = row as KanbanRendererRow;
        const signature = JSON.stringify(row);
        const cached = rowCache.get(candidate.id);
        const target = (row as WireRow).target;
        const mapped =
          cached?.signature === signature
            ? cached.row
            : {
                ...toWorkbenchRow(row, rowResource),
                ...(target
                  ? {
                      target: toWorkbenchNavigationTarget(target, {
                        extensionId: record.extensionId,
                        projectId: context.projectId,
                      }),
                    }
                  : {}),
              };
        originalRows.set(mapped, candidate);
        nextCache.set(mapped.id, { signature, row: mapped });
        return mapped;
      });
      if (queryId === latestQueryId) {
        rowCache = nextCache;
        if (isQueryResult(value)) onMetadata(value);
      }
      return { rows, page: isQueryResult(value) ? value.page : undefined };
    },
  };
};
