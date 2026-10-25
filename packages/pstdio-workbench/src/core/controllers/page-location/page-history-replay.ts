import type { PageLocation } from "@pstdio/sdk/extensions";
import type {
  ResolvedPageLocation,
  WorkbenchPageBrowserEntry,
  WorkbenchPageNavigationResult,
} from "./page-location-types";
import { isPageHistoryState } from "./page-url-resolver";

export const createPageHistoryReplay =
  (input: {
    projectId(): string | undefined;
    removalEpoch?(): string;
    adopt(index: number): void;
    resolve(projectId: string, entry: WorkbenchPageBrowserEntry): ResolvedPageLocation | undefined;
    restore(resolved: ResolvedPageLocation, projectId: string, removalVersion: number): ResolvedPageLocation;
    locationsEqual(left: PageLocation, right: PageLocation): boolean;
    commit(
      projectId: string,
      resolved: ResolvedPageLocation,
      history: "replace" | "none",
      action: string,
    ): WorkbenchPageNavigationResult;
    notify(location: PageLocation): void;
    fail(error: unknown): unknown;
  }) =>
  (entry: WorkbenchPageBrowserEntry) => {
    const projectId = input.projectId();
    if (!projectId) return;
    try {
      if (isPageHistoryState(entry.state) && entry.state.projectId === projectId) input.adopt(entry.state.index);
      const resolved = input.resolve(projectId, entry);
      if (!resolved) throw new Error(`Cannot resolve page URL: ${entry.url}`);
      const state = isPageHistoryState(entry.state) ? entry.state : undefined;
      const version = state?.removalEpoch === input.removalEpoch?.() ? (state?.removalVersion ?? 0) : 0;
      const restored = input.restore(resolved, projectId, version);
      const changed = !input.locationsEqual(resolved.location, restored.location);
      const result = input.commit(
        projectId,
        restored,
        restored.consumeRemembered || changed ? "replace" : "none",
        "replayPageHistory",
      );
      if (result.ok) input.notify(result.location);
    } catch (error) {
      input.fail(error);
    }
  };
