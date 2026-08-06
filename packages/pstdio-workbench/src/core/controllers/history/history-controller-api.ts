import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type { CreateHistoryControllerInput, HistoryController } from "./history-controller";
import { emptyHistoryState, reconcileHistoryState } from "./history-reconciliation";
import { isSameNavigationEntry } from "./history-snapshot";
import type { HistoryStoreState, WorkbenchNavigationEntry } from "./history-types";

interface CreateHistoryControllerApiInput {
  controllerInput: CreateHistoryControllerInput;
  store: WorkbenchStore<HistoryStoreState>;
  activateEntry(
    entry: WorkbenchNavigationEntry,
    options?: { replayCurrentLocation?: boolean },
  ): Promise<unknown> | undefined;
  finishRestore(scope?: string, restoredEntryId?: string): void;
  flush(): void;
  getPersistenceScope(): string | undefined;
  moveCursor(delta: number): WorkbenchNavigationEntry | undefined;
  runSilent(action: () => unknown): void;
  setPersistenceScope(scope: string | undefined): void;
  setState(state: HistoryStoreState, action: string, persist?: boolean): void;
}

export const createHistoryControllerApi = (input: CreateHistoryControllerApiInput): HistoryController => {
  const {
    activateEntry,
    controllerInput,
    finishRestore,
    flush,
    getPersistenceScope,
    moveCursor,
    runSilent,
    setPersistenceScope,
    setState,
    store,
  } = input;

  return {
    store,
    goBack: () => moveCursor(-1),
    goForward: () => moveCursor(1),
    goPrevious() {
      const snapshot = store.getState();
      if (snapshot.hydrating) return undefined;
      const current = snapshot.entries[snapshot.cursor];
      for (let index = snapshot.entries.length - 1; index >= 0; index -= 1) {
        const candidate = snapshot.entries[index];
        if (isSameNavigationEntry(candidate, current)) continue;
        setState({ ...snapshot, cursor: index }, "history.goPrevious");
        runSilent(() => activateEntry(candidate));
        return candidate;
      }
      return undefined;
    },
    recentlyClosed: () => store.getState().recentlyClosed,
    reopenLastClosed() {
      const snapshot = store.getState();
      if (snapshot.hydrating) return undefined;
      const last = snapshot.recentlyClosed.at(-1);
      if (!last) return undefined;
      setState({ ...snapshot, recentlyClosed: snapshot.recentlyClosed.slice(0, -1) }, "history.reopenClosed");
      runSilent(() => {
        const pending = activateEntry(last);
        const reopenSubPanel = () => {
          if (!last.closedSubPanel) return;
          controllerInput.layout.openWidget(last.closedSubPanel.reference.contributionId, {
            region: last.closedSubPanel.region,
            resource: last.closedSubPanel.resource,
            title: last.closedSubPanel.title,
            closable: true,
          });
        };
        if (pending instanceof Promise) void pending.then(reopenSubPanel);
        else reopenSubPanel();
      });
      return last;
    },
    setPersistenceScope,
    getPersistenceScope,
    restore() {
      const snapshot = reconcileHistoryState({
        state: store.getState(),
        layout: controllerInput.layout,
        modes: controllerInput.modes,
        resources: controllerInput.resources,
      });
      setState(snapshot, "history.reconcile");
      const entry = snapshot.entries[snapshot.cursor];
      const scope = getPersistenceScope();
      let pending: Promise<unknown> | undefined;
      if (entry) {
        runSilent(() => {
          const result = activateEntry(entry, { replayCurrentLocation: true });
          if (result instanceof Promise) pending = result;
        });
      }
      if (pending)
        void pending.then(
          () => finishRestore(scope, entry?.entryId),
          () => finishRestore(scope, entry?.entryId),
        );
      else finishRestore(scope, entry?.entryId);
      return entry;
    },
    flush,
    clear() {
      finishRestore();
      setState(emptyHistoryState(), "history.clear");
    },
  };
};
