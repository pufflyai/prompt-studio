import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type { CreateHistoryControllerInput } from "./history-controller";
import type { HistoryStoreState, WorkbenchNavigationEntry } from "./history-types";

interface HistoryRestoreFinisherInput {
  store: WorkbenchStore<HistoryStoreState>;
  activateEntry(entry: WorkbenchNavigationEntry): Promise<unknown> | undefined;
  getScope(): string | undefined;
  onFinish(): void;
  runSilent(action: () => unknown): void;
  setState(state: HistoryStoreState, action: string, persist?: boolean): void;
}

export const createHistoryRestoreFinisher = (input: HistoryRestoreFinisherInput) => {
  const finish = (scope: string | undefined, restoredEntryId?: string) => {
    if (scope !== undefined && scope !== input.getScope()) return;
    const snapshot = input.store.getState();
    const requestedEntry = snapshot.entries[snapshot.cursor];
    if (restoredEntryId && requestedEntry && requestedEntry.entryId !== restoredEntryId) {
      let pending: Promise<unknown> | undefined;
      input.runSilent(() => {
        const result = input.activateEntry(requestedEntry);
        if (result instanceof Promise) pending = result;
      });
      if (pending) {
        void pending.then(
          () => finish(scope, requestedEntry.entryId),
          () => finish(scope, requestedEntry.entryId),
        );
      } else finish(scope, requestedEntry.entryId);
      return;
    }
    input.onFinish();
    if (snapshot.hydrating) {
      input.setState({ ...snapshot, hydrating: false }, "history.finishRestore", false);
    }
  };
  return finish;
};

interface HistoryCursorMoverInput {
  store: WorkbenchStore<HistoryStoreState>;
  activateEntry(entry: WorkbenchNavigationEntry): Promise<unknown> | undefined;
  flush(): void;
  runSilent(action: () => unknown): void;
  setState(state: HistoryStoreState, action: string): void;
}

export const createHistoryCursorMover = (input: HistoryCursorMoverInput) => (delta: number) => {
  const snapshot = input.store.getState();
  const cursor = snapshot.cursor + delta;
  const entry = snapshot.entries[cursor];
  if (!entry) return undefined;
  input.setState({ ...snapshot, cursor }, delta < 0 ? "history.goBack" : "history.goForward");
  input.flush();
  if (!snapshot.hydrating) input.runSilent(() => input.activateEntry(entry));
  return entry;
};

export const trackLayoutScopeRotation = (layout: CreateHistoryControllerInput["layout"]) => {
  let rotating = false;
  layout.onWillChangePersistenceScope(() => {
    rotating = true;
  });
  layout.onDidChangePersistenceScope(() => {
    rotating = false;
  });
  return () => rotating;
};
