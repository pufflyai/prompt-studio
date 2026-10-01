import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { WorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { createPageHistoryEntry } from "./page-location-history-entry";
import type { CreateWorkbenchPageLocationControllerInput } from "./page-location-types";

export const createPageLocationPublisher = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  internals: WorkbenchPageRegistryInternals<Value>,
  hooks: {
    getIndex(): number;
    commitIndex(index: number, push: boolean): void;
    entry: ReturnType<typeof createPageHistoryEntry>;
    publish(): void;
    rememberRootLevel(location: PageLocation): PageLocation | undefined;
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
      const nextIndex = history === "push" ? hooks.getIndex() + 1 : hooks.getIndex();
      // Browser history is the commit boundary. Serialization and the browser write
      // can fail, so both precede changes to stores, placement owners, and caches.
      if (history !== "none") input.browser[history](hooks.entry(projectId, location, nextIndex));
      hooks.commitIndex(nextIndex, history === "push");
      beforePublish?.();
      internals.publish(state, action);
      const rootLevel = hooks.rememberRootLevel(location);
      runWorkbenchEffect(`page location cache for ${projectId}`, () =>
        input.persistence.save(projectId, { location, ...(rootLevel ? { rootLevel } : {}) }),
      );
      if (history !== "none") hooks.publish();
      return { ok: true, location } as const;
    });
};
