import type { PaletteEntry } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { SEARCH_MODE_ID } from "./palette-view";

const RESOURCE_QUERY_LIMIT = 25;
const RESOURCE_QUERY_DEBOUNCE_MS = 150;

interface UseWorkbenchCommandPaletteResourceEntriesInput {
  workbench: WorkbenchCore;
  query: string;
  open: boolean;
  onClose: () => void;
}

// Fetches extension-provided palette results for the live query (debounced) and maps
// them to search-mode palette entries. Provider errors are isolated by the registry, so
// one failing provider never blanks the palette.
export const useWorkbenchCommandPaletteResourceEntries = (input: UseWorkbenchCommandPaletteResourceEntriesInput) => {
  const { workbench, query, open, onClose } = input;
  const refreshToken = useWorkbenchStore(workbench.commandPaletteResources.store, (state) => state.refreshToken);
  const [entries, setEntries] = useState<PaletteEntry[]>([]);

  useEffect(() => {
    if (!open) {
      setEntries([]);
      return;
    }

    // Read so an explicit registry refresh (refreshToken bump) re-runs this query.
    void refreshToken;
    let cancelled = false;
    const handle = setTimeout(() => {
      void workbench.commandPaletteResources.queryProviders({ query, limit: RESOURCE_QUERY_LIMIT }).then((groups) => {
        if (cancelled) return;
        setEntries(
          groups.flatMap((group) =>
            group.results.map((result) => ({
              id: `workbench-command-palette-resource:${result.id}`,
              mode: SEARCH_MODE_ID,
              label: result.label,
              searchText: `${query} ${result.label} ${(result.keywords ?? []).join(" ")}`.trim(),
              description: result.description,
              group: result.group ?? group.title,
              icon: result.icon ? <WorkbenchIcon name={result.icon} /> : undefined,
              onActivate: () => {
                onClose();
                void Promise.resolve(result.activate()).catch(() => undefined);
              },
            })),
          ),
        );
      });
    }, RESOURCE_QUERY_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [workbench, query, open, refreshToken, onClose]);

  return entries;
};
