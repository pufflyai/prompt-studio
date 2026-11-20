import { resourceKey } from "@pstdio/sdk/extensions";
import type { KanbanRendererPlacementBinding } from "./kanban-renderer-registry";

// Bound bodies belong to the renderer's binder, which survives wrappers that copy the contribution.
// Each placement and resource keeps one body, so its query state and query-supplied columns persist.
const bodies = new WeakMap<object, Map<string, object>>();
// The merged contribution is stable while its source object is.
const merged = new WeakMap<object, Map<string, object>>();

const entry = (cache: WeakMap<object, Map<string, object>>, owner: object) => {
  let map = cache.get(owner);
  if (!map) {
    map = new Map();
    cache.set(owner, map);
  }
  return map;
};

/** Returns the renderer bound to this placement, or the renderer itself when it does not bind. */
export const bindKanbanRendererContribution = <
  Contribution extends { forPlacement?(binding: KanbanRendererPlacementBinding): object },
>(
  contribution: Contribution,
  binding: KanbanRendererPlacementBinding,
): Contribution => {
  const forPlacement = contribution.forPlacement;
  if (!forPlacement) return contribution;
  const key = JSON.stringify([binding.instanceId, binding.resource ? resourceKey(binding.resource) : null]);
  const mergedByKey = entry(merged, contribution);
  const cached = mergedByKey.get(key);
  if (cached) return cached as Contribution;
  const bodiesByKey = entry(bodies, forPlacement);
  let body = bodiesByKey.get(key);
  if (!body) {
    body = forPlacement.call(contribution, binding);
    bodiesByKey.set(key, body);
  }
  const next = { ...contribution, ...body } as Contribution;
  mergedByKey.set(key, next);
  return next;
};
