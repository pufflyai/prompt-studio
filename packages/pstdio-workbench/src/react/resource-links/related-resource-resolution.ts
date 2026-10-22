import { type RelatedResourceOpening, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { NavigationTarget } from "../../core";
import type { ResourceLinksService } from "./resource-links-types";

const targetAvailable = (target: NavigationTarget, available: (resource: ResourceRef) => boolean) => {
  const pending = [target];
  while (pending.length) {
    const item = pending.pop()!;
    if (item.kind === "compound") pending.push(...item.targets);
    else if ((item.kind === "page" || item.kind === "panel") && item.resource && !available(item.resource))
      return false;
  }
  return true;
};

interface RelatedResolutionInput {
  defaults: RelatedResourceOpening[];
  openings: RelatedResourceOpening[];
  service: ResourceLinksService;
  signal: AbortSignal;
  available(resource: ResourceRef): boolean;
  current(): boolean;
}

export const resolveRelatedOpenings = async (input: RelatedResolutionInput) => {
  const { defaults, openings, service, signal, available, current } = input;
  const resolved = await service.resolve(
    openings.filter((entry) => available(entry.resource)).map((entry) => entry.resource),
    signal,
  );
  if (!current()) return [];
  const targets = new Map(resolved.map((entry) => [resourceKey(entry.resource), entry.target]));
  // The owner may have deleted a remembered choice while this page or app was closed.
  // Fall back for this visit without erasing a choice on a transient resolver failure.
  const fallbacks = defaults.filter((entry, index) => {
    const choice = openings[index]!;
    return (
      resourceKey(choice.resource) !== resourceKey(entry.resource) &&
      (!available(choice.resource) || !targets.get(resourceKey(choice.resource)))
    );
  });
  if (fallbacks.length) {
    const fallbackTargets = await service.resolve(
      fallbacks.map((entry) => entry.resource),
      signal,
    );
    if (!current()) return [];
    for (const entry of fallbackTargets) targets.set(resourceKey(entry.resource), entry.target);
  }
  return openings.flatMap((choice, index) => {
    const entry = fallbacks.includes(defaults[index]!) ? defaults[index]! : choice;
    const target = targets.get(resourceKey(entry.resource));
    return target && available(entry.resource) && targetAvailable(target, available) ? [{ entry, target }] : [];
  });
};
