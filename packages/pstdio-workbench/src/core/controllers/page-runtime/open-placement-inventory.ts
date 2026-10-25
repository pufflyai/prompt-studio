import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";

type Owner = string | undefined | symbol;

// Saved scopes and the current layout share placements. Closing one owner must
// not remove a tab that another owner still keeps open.
export const createOpenPlacementInventory = () => {
  const currentOwner = Symbol("current layout");
  const owners = new Map<Owner, Map<string, WorkbenchWidgetPlacement>>();
  const placements = new Map<string, Map<Owner, WorkbenchWidgetPlacement>>();
  const selected = new Map<string, WorkbenchWidgetPlacement>();
  const latestSaved = new Map<string, Owner>();
  const resourceOwners = new Map<string, Set<Owner>>();
  let current: WorkbenchLayout | undefined;
  let ids: ReadonlySet<string> | undefined;
  let placementList: WorkbenchWidgetPlacement[] | undefined;
  let resources: ResourceRef[] | undefined;

  const choose = (id: string) => {
    const candidates = placements.get(id);
    const previous = selected.get(id);
    const next = candidates?.get(currentOwner) ?? candidates?.get(latestSaved.get(id));
    if (previous === next) return;
    if (Boolean(previous) !== Boolean(next)) ids = undefined;
    if (previous?.resource !== next?.resource) resources = undefined;
    if (next) selected.set(id, next);
    else selected.delete(id);
    placementList = undefined;
  };

  const referencedKeys = (placement: WorkbenchWidgetPlacement) => {
    const keys = placement.resource ? [resourceKey(placement.resource)] : [];
    let parent = placement.pageContext?.parent;
    while (parent) {
      if (parent.resource) keys.push(resourceKey(parent.resource));
      parent = parent.parent;
    }
    return keys;
  };
  const updateResources = (
    owner: Owner,
    previous: Map<string, WorkbenchWidgetPlacement>,
    next: Map<string, WorkbenchWidgetPlacement>,
  ) => {
    const previousResources = new Set([...previous.values()].flatMap(referencedKeys));
    const nextResources = new Set([...next.values()].flatMap(referencedKeys));
    for (const key of previousResources) {
      if (nextResources.has(key)) continue;
      const entries = resourceOwners.get(key)!;
      entries.delete(owner);
      if (!entries.size) resourceOwners.delete(key);
    }
    for (const key of nextResources) {
      if (previousResources.has(key)) continue;
      let entries = resourceOwners.get(key);
      if (!entries) {
        entries = new Set();
        resourceOwners.set(key, entries);
      }
      entries.add(owner);
    }
  };
  const removePlacement = (owner: Owner, id: string) => {
    const entries = placements.get(id)!;
    entries.delete(owner);
    if (latestSaved.get(id) === owner) {
      latestSaved.delete(id);
      for (const candidate of entries.keys()) {
        if (candidate !== currentOwner) latestSaved.set(id, candidate);
      }
    }
    if (!entries.size) placements.delete(id);
    choose(id);
  };
  const updatePlacements = (
    owner: Owner,
    previous: Map<string, WorkbenchWidgetPlacement>,
    next: Map<string, WorkbenchWidgetPlacement>,
  ) => {
    for (const id of previous.keys()) {
      if (!next.has(id)) removePlacement(owner, id);
    }
    for (const [id, placement] of next) {
      if (previous.get(id) === placement) continue;
      let entries = placements.get(id);
      if (!entries) {
        entries = new Map();
        placements.set(id, entries);
      }
      entries.delete(owner);
      entries.set(owner, placement);
      if (owner !== currentOwner) latestSaved.set(id, owner);
      choose(id);
    }
  };
  const set = (owner: Owner, layout: WorkbenchLayout | undefined) => {
    const previous = owners.get(owner) ?? new Map<string, WorkbenchWidgetPlacement>();
    const next = new Map(
      Object.values(layout?.regions ?? {}).flatMap((region) => region.widgets.map((p) => [p.widgetId, p] as const)),
    );
    updateResources(owner, previous, next);
    updatePlacements(owner, previous, next);
    if (next.size) owners.set(owner, next);
    else owners.delete(owner);
  };

  return {
    set,
    removeResource(owner: string | undefined, resource: ResourceRef) {
      const previous = owners.get(owner);
      if (!previous) return;
      const key = resourceKey(resource);
      const next = new Map([...previous].filter(([, placement]) => resourceKey(placement.resource) !== key));
      updateResources(owner, previous, next);
      updatePlacements(owner, previous, next);
      if (next.size) owners.set(owner, next);
      else owners.delete(owner);
    },
    setCurrent(layout: WorkbenchLayout) {
      if (current === layout) return;
      current = layout;
      set(currentOwner, layout);
    },
    getIds: () => (ids ??= new Set(selected.keys())),
    getPlacements: () => (placementList ??= [...selected.values()]),
    getResources: () => {
      resources ??= [
        ...new Map(
          [...selected.values()].flatMap((p) => (p.resource ? [[resourceKey(p.resource), p.resource] as const] : [])),
        ).values(),
      ];
      return resources;
    },
    getScopes(resource: ResourceRef) {
      return [...(resourceOwners.get(resourceKey(resource)) ?? [])].filter(
        (owner): owner is string | undefined => typeof owner !== "symbol",
      );
    },
  };
};
