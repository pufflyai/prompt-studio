import type { Frame, SlotOwner } from "./frame-types";
import type { LayoutPersistenceAdapter, LayoutScope } from "./layout-model";
import { createDefaultWorkbenchLayout, mergeWithDefaultAreas, type WorkbenchLayout } from "./layout-types";

export const layoutScopeKey = (scope: LayoutScope | undefined) => {
  if (!scope) return "global";
  const mode = encodeURIComponent(scope.mode);
  return scope.resource ? `mode:${mode}:resource:${encodeURIComponent(scope.resource)}` : `mode:${mode}`;
};

export const layoutScopesEqual = (left: LayoutScope | undefined, right: LayoutScope | undefined) =>
  layoutScopeKey(left) === layoutScopeKey(right);

export const layoutScopeForOwner = (scope: LayoutScope | undefined, owner: SlotOwner) => {
  if (!scope || owner === "resource") return scope;
  return { mode: scope.mode } satisfies LayoutScope;
};

export const persistenceScopes = (scope: LayoutScope | undefined) => {
  const candidates = [layoutScopeForOwner(scope, "project"), layoutScopeForOwner(scope, "resource")];
  return candidates.filter(
    (candidate, index) => candidates.findIndex((current) => layoutScopesEqual(current, candidate)) === index,
  );
};

export const changedLayoutOwners = (current: LayoutScope | undefined, next: LayoutScope | undefined) =>
  (["project", "resource"] as const).filter(
    (owner) => !layoutScopesEqual(layoutScopeForOwner(current, owner), layoutScopeForOwner(next, owner)),
  );

interface RestoreScopedLayoutInput {
  current: WorkbenchLayout;
  currentScope: LayoutScope | undefined;
  nextScope: LayoutScope | undefined;
  frame: Frame;
  persistence?: LayoutPersistenceAdapter;
}

const readOwnerLayout = (
  persistence: LayoutPersistenceAdapter | undefined,
  frame: Frame,
  scope: LayoutScope | undefined,
  owner: SlotOwner,
) => {
  const persisted = persistence?.getLayout(layoutScopeForOwner(scope, owner));
  return persisted ? mergeWithDefaultAreas(persisted, frame) : createDefaultWorkbenchLayout(frame);
};

export const restoreScopedLayout = (input: RestoreScopedLayoutInput) => {
  const owners = ["project", "resource"] as const;
  const changed = new Set(changedLayoutOwners(input.currentScope, input.nextScope));
  if (changed.size === 0) return input.current;

  const incoming = Object.fromEntries(
    owners.map((owner) => [owner, readOwnerLayout(input.persistence, input.frame, input.nextScope, owner)]),
  ) as Record<SlotOwner, WorkbenchLayout>;
  const areas = { ...input.current.areas };
  const nodes = { ...input.current.nodes };

  for (const slot of Object.values(input.frame.slots)) {
    if (!changed.has(slot.owner)) continue;
    areas[slot.id] = incoming[slot.owner].areas[slot.id] ?? { id: slot.id, widgets: [] };
    const node = incoming[slot.owner].nodes[slot.id];
    if (node) nodes[slot.id] = node;
    else delete nodes[slot.id];
  }

  const currentActiveOwner = input.current.activeSlotId
    ? input.frame.slots[input.current.activeSlotId]?.owner
    : undefined;
  const candidates = owners
    .filter((owner) => changed.has(owner))
    .map((owner) => incoming[owner])
    .filter((layout) => {
      const activeSlotId = layout.activeSlotId;
      return activeSlotId && changed.has(input.frame.slots[activeSlotId]?.owner ?? "resource");
    });
  const active = currentActiveOwner && !changed.has(currentActiveOwner) ? input.current : candidates.at(-1);

  return {
    areas,
    nodes,
    activeSlotId: active?.activeSlotId,
    activeResourceUri: active?.activeResourceUri,
    orphans: changed.has("project") ? incoming.project.orphans : input.current.orphans,
  };
};
