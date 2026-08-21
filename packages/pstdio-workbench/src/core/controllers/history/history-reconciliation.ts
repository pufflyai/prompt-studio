import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import type { ResourceRegistry } from "../../registries/resources/resource-registry";
import { compactNavigationEntries } from "./history-snapshot";
import type { HistoryStoreState, PersistedWorkbenchHistory, WorkbenchNavigationEntry } from "./history-types";

export const WORKBENCH_HISTORY_VERSION = 1 as const;
const RECENTLY_CLOSED_LIMIT = 20;

export const emptyHistoryState = (): HistoryStoreState => ({
  entries: [],
  cursor: -1,
  recentlyClosed: [],
  hydrating: false,
});

export const hydrateHistoryState = (persisted: PersistedWorkbenchHistory | undefined): HistoryStoreState => {
  if (persisted?.version !== WORKBENCH_HISTORY_VERSION) return emptyHistoryState();
  const entries = compactNavigationEntries(persisted.entries);
  return {
    entries,
    cursor: Math.min(Math.max(persisted.cursor, entries.length > 0 ? 0 : -1), entries.length - 1),
    recentlyClosed: persisted.recentlyClosed.slice(-RECENTLY_CLOSED_LIMIT),
    hydrating: false,
  };
};

const reconcileEntry = (input: {
  entry: WorkbenchNavigationEntry;
  layout: LayoutModel;
  modes?: Pick<WorkbenchModeRegistry, "getMode">;
  resources: ResourceRegistry;
}) => {
  const { entry, layout, modes, resources } = input;
  if (entry.modeId && modes && !modes.getMode(entry.modeId)) return undefined;
  if (entry.closedSubPanel && !layout.getWidget(entry.closedSubPanel.reference.contributionId)) {
    return undefined;
  }
  const contribution = entry.contributionId ? layout.getWidget(entry.contributionId) : undefined;
  const hasLocation =
    entry.kind === "mode"
      ? Boolean(entry.modeId && modes?.getMode(entry.modeId))
      : Boolean(
          (contribution && !contribution.panelMenuOwner && !contribution.eligibleLocations) ||
            (entry.resource && resources.listPresenters().some((presenter) => presenter.canOpen(entry.resource!))),
        );
  if (!hasLocation) return undefined;

  const selectedSubPanels = Object.fromEntries(
    Object.entries(entry.selectedSubPanels).filter(([, reference]) => {
      const widget = reference ? layout.getWidget(reference.contributionId) : undefined;
      return Boolean(widget);
    }),
  ) as WorkbenchNavigationEntry["selectedSubPanels"];
  return { ...entry, selectedSubPanels };
};

export const reconcileHistoryState = (input: {
  state: HistoryStoreState;
  layout: LayoutModel;
  modes?: Pick<WorkbenchModeRegistry, "getMode">;
  resources: ResourceRegistry;
}) => {
  const { state } = input;
  const currentEntryId = state.entries[state.cursor]?.entryId;
  const entries = compactNavigationEntries(
    state.entries
      .map((entry) => reconcileEntry({ ...input, entry }))
      .filter((entry): entry is WorkbenchNavigationEntry => Boolean(entry)),
  );
  const retainedCursor = currentEntryId ? entries.findIndex((entry) => entry.entryId === currentEntryId) : -1;
  const cursor = retainedCursor >= 0 ? retainedCursor : Math.min(state.cursor, entries.length - 1);
  const recentlyClosed = state.recentlyClosed
    .map((entry) => reconcileEntry({ ...input, entry }))
    .filter((entry): entry is WorkbenchNavigationEntry => Boolean(entry));
  return { ...state, entries, cursor, recentlyClosed };
};
