import { resourceKey } from "@pstdio/sdk/extensions";
import type { KanbanRendererPlacementBinding } from "./kanban-renderer-registry";

// One bound renderer per placement and resource, so views and dialogs keep a stable contribution.
const bindings = new WeakMap<object, Map<string, object>>();

/** Returns the renderer bound to this placement, or the renderer itself when it does not bind. */
export const bindKanbanRendererContribution = <
  Contribution extends { forPlacement?(binding: KanbanRendererPlacementBinding): object },
>(
  contribution: Contribution,
  binding: KanbanRendererPlacementBinding,
): Contribution => {
  if (!contribution.forPlacement) return contribution;
  const key = JSON.stringify([binding.instanceId, binding.resource ? resourceKey(binding.resource) : null]);
  let bound = bindings.get(contribution);
  if (!bound) {
    bound = new Map();
    bindings.set(contribution, bound);
  }
  const cached = bound.get(key);
  if (cached) return cached as Contribution;
  const next = { ...contribution, ...contribution.forPlacement(binding) } as Contribution;
  bound.set(key, next);
  return next;
};
