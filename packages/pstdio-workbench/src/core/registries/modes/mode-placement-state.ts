import type { JsonObject, JsonValue, PageOpenIntent, PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../layout/layout-types";
import type { WorkbenchPlacementOwnerState } from "../layout/owned-placement-state";
import { placementIdentityKey, type ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import type { WorkbenchModePlacementContribution } from "./mode-placement-registry-types";

export const getModePlacementOwnerState = (modeId: string, ownerState: WorkbenchPlacementOwnerState | undefined) =>
  ownerState?.owner.kind === "mode" && ownerState.owner.modeId === modeId ? ownerState : undefined;

export const isStaticModePlacementOpen = (input: {
  placement: WorkbenchModePlacementContribution;
  ownerState?: WorkbenchPlacementOwnerState;
  identity: PlacementIdentity;
}) => {
  if (input.placement.required) return true;
  const saved = input.ownerState?.staticPlacements.find(
    (candidate) => placementIdentityKey(candidate.identity) === placementIdentityKey(input.identity),
  );
  return saved?.open ?? input.placement.defaultOpen !== false;
};

export const restorePinnedModePlacements = (input: {
  modeId: string;
  ownerState?: WorkbenchPlacementOwnerState;
  getPlacement(placementId: string): WorkbenchModePlacementContribution | undefined;
  resolve(
    placement: WorkbenchModePlacementContribution,
    resource?: ResourceRef,
    open?: PageOpenIntent,
  ): ResolvedOwnedPlacement<WorkbenchWidgetPlacement>;
}) => {
  const restored: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[] = [];
  for (const saved of getModePlacementOwnerState(input.modeId, input.ownerState)?.pinnedPlacements ?? []) {
    const identity = saved.identity;
    if (identity.kind !== "mode" || identity.modeId !== input.modeId) continue;
    const declaration = input.getPlacement(identity.placementId);
    if (!declaration || declaration.modeId !== input.modeId || declaration.item.kind !== "resource") continue;
    if (declaration.item.cardinality !== "many" || declaration.item.resourceKind !== saved.resource.type) continue;
    const candidate = input.resolve(declaration, saved.resource, "pin");
    if (placementIdentityKey(candidate.identity) !== placementIdentityKey(identity)) continue;
    restored.push(candidate);
  }
  return restored;
};

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;
  return Object.values(value).every(isJsonValue);
};

const toJsonMetadata = (metadata: Record<string, unknown> | undefined): JsonObject | undefined =>
  metadata && isJsonValue(metadata) ? metadata : undefined;

export const toPersistedModeResource = (placement: WorkbenchWidgetPlacement): ResourceRef | undefined => {
  const resource = placement.resource;
  if (!resource?.id) return undefined;
  const metadata = toJsonMetadata(resource.metadata);
  return {
    type: resource.kind,
    id: resource.id,
    ...(resource.projectId ? { projectId: resource.projectId } : {}),
    ...(resource.extensionId ? { extensionId: resource.extensionId } : {}),
    ...(resource.label ? { label: resource.label } : {}),
    ...(metadata ? { metadata } : {}),
  };
};
