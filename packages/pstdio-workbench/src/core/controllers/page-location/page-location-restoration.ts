import type { PageLocation } from "@pstdio/sdk/extensions";
import type { ResolvedPageLocation } from "./page-location-types";

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
