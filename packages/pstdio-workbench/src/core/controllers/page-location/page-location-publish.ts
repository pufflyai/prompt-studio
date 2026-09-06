import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { WorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { createPageHistoryEntry } from "./page-location-history-entry";
import type { CreateWorkbenchPageLocationControllerInput } from "./page-location-types";

export const createPageLocationPublisher = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  internals: WorkbenchPageRegistryInternals<Value>,
  historyState: {
    getIndex(): number;
    commitIndex(index: number, push: boolean): void;
    entry: ReturnType<typeof createPageHistoryEntry>;
    publish(): void;
  },
) => {
  return (
    projectId: string,
    state: WorkbenchPageRegistryStoreState<Value>,
    history: "push" | "replace" | "none",
    action: string,
    beforePublish?: () => void,
  ) =>
    batchWorkbenchChanges(() => {
      const location = state.location;
      if (!location) throw new Error("Prepared page navigation has no location");
      const nextIndex = history === "push" ? historyState.getIndex() + 1 : historyState.getIndex();
      // Browser history is the commit boundary. Serialization and the browser write
      // can fail, so both precede changes to stores, placement owners, and caches.
      if (history !== "none") input.browser[history](historyState.entry(projectId, location, nextIndex));
      historyState.commitIndex(nextIndex, history === "push");
      beforePublish?.();
      internals.publish(state, action);
      runWorkbenchEffect(`page location cache for ${projectId}`, () => input.persistence.save(projectId, location));
      if (history !== "none") historyState.publish();
      return { ok: true, location } as const;
    });
};
