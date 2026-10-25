import { useState } from "react";
import type { DataTableRendererColumn, DataTableRendererQueryResult } from "../../../core";
import { rendererQueryKey } from "../renderer-query-key";
import { resolveDataTableRendererColumns } from "./data-table-view-model";

type PageColumn = Pick<DataTableRendererColumn, "id" | "hidden">;

/** Accepted column metadata owns field selection; loaded rows stay in the renderer read. */
export const useTablePageColumns = (scope: string, declared: DataTableRendererColumn[] | undefined) => {
  const [accepted, setAccepted] = useState<{ scope: string; columns?: PageColumn[] }>({ scope });
  if (accepted.scope !== scope) setAccepted({ scope });
  const columns = accepted.scope === scope ? (accepted.columns ?? declared ?? []) : (declared ?? []);
  return {
    columns,
    pending: (loaded: string[] | undefined, requested: string[], error: string | undefined) =>
      !error && loaded !== undefined && rendererQueryKey(loaded) !== rendererQueryKey(requested),
    accept: (result: DataTableRendererQueryResult | undefined, enabled: boolean) => {
      if (!enabled || !result) return;
      const selection = resolveDataTableRendererColumns(result, declared).map(({ id, hidden }) => ({ id, hidden }));
      if (rendererQueryKey(selection) !== rendererQueryKey(columns.map(({ id, hidden }) => ({ id, hidden }))))
        setAccepted({ scope, columns: selection });
    },
  };
};
