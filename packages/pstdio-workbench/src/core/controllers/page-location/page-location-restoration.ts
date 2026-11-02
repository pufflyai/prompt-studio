import type { PageLocation } from "@pstdio/sdk/extensions";
import type { ResolvedPageLocation, WorkbenchPageNavigationResult } from "./page-location-types";

type RestoreSource = "boot" | "project-switch";
export const createStartLocationRestorer =
  (input: {
    start(): ResolvedPageLocation;
    commit(
      projectId: string,
      resolved: ResolvedPageLocation,
      history: "replace",
      action: string,
    ): WorkbenchPageNavigationResult;
    restoreEmpty(selectedModeId?: string): void;
    fail(source: RestoreSource, error: unknown): WorkbenchPageNavigationResult;
  }) =>
  (projectId: string, source: RestoreSource, selectedModeId?: string) => {
    let resolved: ResolvedPageLocation;
    try {
      resolved = input.start();
    } catch (error) {
      try {
        input.restoreEmpty(selectedModeId);
      } catch (restoreError) {
        return input.fail(source, restoreError);
      }
      return input.fail(source, error);
    }
    try {
      return input.commit(projectId, resolved, "replace", `${source}StartFallback`);
    } catch (error) {
      return input.fail(source, error);
    }
  };

/** Resolve navigation memory without changing it before the browser commit succeeds. */
export const restoreRememberedLocation = (
  fallback: ResolvedPageLocation,
  remembered: PageLocation | undefined,
  normalize: (location: PageLocation) => ResolvedPageLocation,
  restore?: (location: PageLocation) => PageLocation,
): ResolvedPageLocation => {
  if (!remembered) return fallback;
  let resolved: ResolvedPageLocation;
  try {
    resolved = normalize(remembered);
  } catch {
    return { ...fallback, consumeRemembered: remembered };
  }
  const location = restore?.(resolved.location) ?? resolved.location;
  if (location === resolved.location) return resolved;
  return { ...normalize(location), consumeRemembered: remembered };
};
