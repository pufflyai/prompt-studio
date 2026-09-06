import type { PageLocation, PageOpenIntent, PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import type { Disposable } from "../../shared/disposable";
import type { WorkbenchWidgetPlacement } from "../layout/layout-types";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import {
  type OwnedPlacementState,
  openResourcePlacement,
  openStaticPlacement,
  type WorkbenchOwnedPlacementItem,
} from "./owned-placement-lifecycle";

export interface OwnedPlacementOpenInput {
  placementId: string;
  resource?: ResourceRef;
  open?: PageOpenIntent;
  title?: string;
}
export interface OwnedPlacementLocationContext {
  modeId: string;
  pageId?: string;
  projectId?: string;
  location?: PageLocation;
}
export interface OwnedPlacementPreparation {
  connectRuntime(listener: () => void): Disposable;
  restore?(
    context: OwnedPlacementLocationContext,
    state?: OwnedPlacementState,
    previousContext?: OwnedPlacementLocationContext,
  ): OwnedPlacementState;
  adopt?(
    modeId: string,
    placements: readonly WorkbenchWidgetPlacement[],
    state?: OwnedPlacementState,
  ): OwnedPlacementState;
  getState(): OwnedPlacementState;
  open(
    target: OwnedPlacementOpenInput,
    current?: OwnedPlacementState,
  ): { state: OwnedPlacementState; identity: PlacementIdentity };
  resolve(modeId?: string, state?: OwnedPlacementState): readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
  apply(state: OwnedPlacementState): void;
  publish(): void;
}
const preparations = new WeakMap<object, OwnedPlacementPreparation>();
export const setOwnedPlacementPreparation = (registry: object, preparation: OwnedPlacementPreparation) =>
  preparations.set(registry, preparation);
export const getOwnedPlacementPreparation = (registry: object) => {
  const preparation = preparations.get(registry);
  if (!preparation) throw new Error("Owned placement preparation is unavailable");
  return preparation;
};
export const prepareOwnedPlacement = (input: {
  label: string;
  target: OwnedPlacementOpenInput;
  item: WorkbenchOwnedPlacementItem;
  current: OwnedPlacementState;
  identityFor(instanceKey: string): PlacementIdentity;
}) => {
  const state = {
    staticOverrides: new Map(input.current.staticOverrides),
    resourceInstances: new Map(input.current.resourceInstances),
  };
  const operation = { ...input.target, label: input.label, id: input.target.placementId, item: input.item, state };
  let instanceKey = "default";
  if (input.item.kind === "view") openStaticPlacement(operation);
  else instanceKey = openResourcePlacement(operation);
  return { state, identity: input.identityFor(instanceKey) };
};
