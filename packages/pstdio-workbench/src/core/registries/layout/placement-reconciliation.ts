import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { type WorkbenchRegion, workbenchRegions } from "./layout-types";

export interface ResolvedOwnedPlacement<Value = unknown> {
  identity: PlacementIdentity;
  region: WorkbenchRegion;
  order: number;
  value: Value;
}

export interface ComposeOwnedPlacementsInput<Value> {
  shell: readonly ResolvedOwnedPlacement<Value>[];
  mode?: readonly ResolvedOwnedPlacement<Value>[];
  page?: readonly ResolvedOwnedPlacement<Value>[];
  closed?: readonly PlacementIdentity[];
}

export interface ComposedOwnedPlacements<Value> {
  placements: readonly ResolvedOwnedPlacement<Value>[];
  closed: readonly ResolvedOwnedPlacement<Value>[];
  regions: Record<WorkbenchRegion, readonly ResolvedOwnedPlacement<Value>[]>;
  visibleRegions: ReadonlySet<WorkbenchRegion>;
}

export interface OwnedPlacementUpdate<Value> {
  current: ResolvedOwnedPlacement<Value>;
  desired: ResolvedOwnedPlacement<Value>;
}

export interface OwnedPlacementReconciliation<Value> {
  add: readonly ResolvedOwnedPlacement<Value>[];
  retain: readonly ResolvedOwnedPlacement<Value>[];
  update: readonly OwnedPlacementUpdate<Value>[];
  activate: readonly ResolvedOwnedPlacement<Value>[];
  remove: readonly ResolvedOwnedPlacement<Value>[];
}

export interface ReconcileOwnedPlacementsInput<Value> {
  current: readonly ResolvedOwnedPlacement<Value>[];
  desired: readonly ResolvedOwnedPlacement<Value>[];
  activate?: readonly PlacementIdentity[];
  valuesEqual: (current: Value, desired: Value) => boolean;
}

const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const placementOwnerSortKey = (identity: PlacementIdentity) => {
  if (identity.kind === "shell") return `shell\0${identity.placementId}`;
  if (identity.kind === "mode") return `mode\0${identity.modeId}\0${identity.placementId}`;
  return `page\0${identity.pageId}\0${identity.slotId}`;
};

export const placementIdentityKey = (identity: PlacementIdentity) => {
  if (identity.kind === "shell") return JSON.stringify(["shell", identity.placementId, identity.instanceKey]);
  if (identity.kind === "mode") {
    return JSON.stringify(["mode", identity.modeId, identity.placementId, identity.instanceKey]);
  }
  return JSON.stringify(["page", identity.pageId, identity.slotId, identity.instanceKey]);
};

const comparePlacementIdentity = (left: ResolvedOwnedPlacement<unknown>, right: ResolvedOwnedPlacement<unknown>) => {
  const owner = compareText(placementOwnerSortKey(left.identity), placementOwnerSortKey(right.identity));
  if (owner !== 0) return owner;
  return compareText(left.identity.instanceKey, right.identity.instanceKey);
};

const compareRegionPlacement = (left: ResolvedOwnedPlacement<unknown>, right: ResolvedOwnedPlacement<unknown>) =>
  left.order - right.order || comparePlacementIdentity(left, right);

const assertOwner = (owner: PlacementIdentity["kind"], placement: ResolvedOwnedPlacement<unknown>) => {
  if (placement.identity.kind === owner) return;
  const label = `${owner[0]?.toUpperCase()}${owner.slice(1)}`;
  throw new Error(`${label} placement must have a ${owner} owner`);
};

const collectPlacements = <Value>(input: ComposeOwnedPlacementsInput<Value>) => {
  const placements: ResolvedOwnedPlacement<Value>[] = [];
  const seen = new Set<string>();
  const add = (owner: PlacementIdentity["kind"], candidates: readonly ResolvedOwnedPlacement<Value>[]) => {
    for (const candidate of candidates) {
      assertOwner(owner, candidate);
      if (!Number.isFinite(candidate.order)) throw new Error("Placement order must be a finite number");
      const key = placementIdentityKey(candidate.identity);
      if (seen.has(key)) throw new Error(`Duplicate placement identity: ${key}`);
      seen.add(key);
      placements.push(candidate);
    }
  };

  add("shell", input.shell);
  add("mode", input.mode ?? []);
  add("page", input.page ?? []);
  const modeIds = new Set(
    (input.mode ?? []).map((placement) =>
      placement.identity.kind === "mode" ? placement.identity.modeId : "invalid-mode-owner",
    ),
  );
  const pageIds = new Set(
    (input.page ?? []).map((placement) =>
      placement.identity.kind === "page" ? placement.identity.pageId : "invalid-page-owner",
    ),
  );
  if (modeIds.size > 1) throw new Error("Mode placements must belong to one active mode");
  if (pageIds.size > 1) throw new Error("Page placements must belong to one active page");
  return placements;
};

const emptyRegions = <Value>() =>
  workbenchRegions.reduce(
    (regions, region) => {
      regions[region] = [];
      return regions;
    },
    {} as Record<WorkbenchRegion, ResolvedOwnedPlacement<Value>[]>,
  );

export const composeOwnedPlacements = <Value>(
  input: ComposeOwnedPlacementsInput<Value>,
): ComposedOwnedPlacements<Value> => {
  const declared = collectPlacements(input);
  const closedKeys = new Set((input.closed ?? []).map(placementIdentityKey));
  const closed: ResolvedOwnedPlacement<Value>[] = [];
  const regions = emptyRegions<Value>();

  for (const placement of declared) {
    if (closedKeys.has(placementIdentityKey(placement.identity))) {
      closed.push(placement);
      continue;
    }
    regions[placement.region].push(placement);
  }

  for (const region of workbenchRegions) regions[region].sort(compareRegionPlacement);
  closed.sort(comparePlacementIdentity);
  const placements = workbenchRegions.flatMap((region) => regions[region]);
  const visibleRegions = new Set(workbenchRegions.filter((region) => regions[region].length > 0));
  return { placements, closed, regions, visibleRegions };
};

const indexPlacements = <Value>(placements: readonly ResolvedOwnedPlacement<Value>[]) => {
  const indexed = new Map<string, ResolvedOwnedPlacement<Value>>();
  for (const placement of placements) {
    const key = placementIdentityKey(placement.identity);
    if (indexed.has(key)) throw new Error(`Duplicate placement identity: ${key}`);
    indexed.set(key, placement);
  }
  return indexed;
};

const placementShapeEqual = <Value>(
  current: ResolvedOwnedPlacement<Value>,
  desired: ResolvedOwnedPlacement<Value>,
  valuesEqual: (current: Value, desired: Value) => boolean,
) => current.region === desired.region && current.order === desired.order && valuesEqual(current.value, desired.value);

export const reconcileOwnedPlacements = <Value>(
  input: ReconcileOwnedPlacementsInput<Value>,
): OwnedPlacementReconciliation<Value> => {
  const current = indexPlacements(input.current);
  const desired = indexPlacements(input.desired);
  const add: ResolvedOwnedPlacement<Value>[] = [];
  const retain: ResolvedOwnedPlacement<Value>[] = [];
  const update: OwnedPlacementUpdate<Value>[] = [];
  const remove: ResolvedOwnedPlacement<Value>[] = [];

  for (const [key, desiredPlacement] of desired) {
    const currentPlacement = current.get(key);
    if (!currentPlacement) {
      add.push(desiredPlacement);
    } else if (placementShapeEqual(currentPlacement, desiredPlacement, input.valuesEqual)) {
      retain.push(desiredPlacement);
    } else {
      update.push({ current: currentPlacement, desired: desiredPlacement });
    }
  }
  for (const [key, currentPlacement] of current) if (!desired.has(key)) remove.push(currentPlacement);

  const activationKeys = new Set((input.activate ?? []).map(placementIdentityKey));
  const activate = Array.from(activationKeys, (key) => {
    const placement = desired.get(key);
    if (!placement) throw new Error(`Cannot activate missing placement: ${key}`);
    return placement;
  });

  add.sort(comparePlacementIdentity);
  retain.sort(comparePlacementIdentity);
  update.sort((left, right) => comparePlacementIdentity(left.desired, right.desired));
  activate.sort(comparePlacementIdentity);
  remove.sort(comparePlacementIdentity);
  return { add, retain, update, activate, remove };
};
