import type { WorkbenchStore } from "../../shared/store/workbench-store";
import { WORKBENCH_HISTORY_VERSION } from "./history-reconciliation";
import type { HistoryStoreState, WorkbenchHistoryPersistence } from "./history-types";

const PERSISTENCE_DELAY_MS = 50;

interface HistoryPersistenceSchedulerInput {
  persistence?: WorkbenchHistoryPersistence;
  store: WorkbenchStore<HistoryStoreState>;
  getScope(): string | undefined;
}

export const createHistoryPersistenceScheduler = (input: HistoryPersistenceSchedulerInput) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!input.persistence) return;
    const { hydrating: _hydrating, ...state } = input.store.getState();
    input.persistence.setHistory({ ...state, version: WORKBENCH_HISTORY_VERSION }, input.getScope());
  };

  return {
    flush,
    schedule() {
      if (!input.persistence || timer) return;
      timer = setTimeout(flush, PERSISTENCE_DELAY_MS);
    },
  };
};
