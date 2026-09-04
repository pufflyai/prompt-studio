import type { PageOpenIntent } from "@pstdio/sdk/extensions";
import type { NavigationTarget } from "../navigation/navigation-registry";
import type { ResourceRef } from "../resources/resource-registry";

export type WorkbenchPlacementPresence = "fixed" | "open" | "closed";

export type WorkbenchOwnedPlacementItem =
  | { readonly kind: "view"; readonly viewId: string; readonly presence: WorkbenchPlacementPresence }
  | {
      readonly kind: "resource";
      readonly viewId: string;
      readonly resourceKinds: readonly string[];
      readonly cardinality: "one" | "many";
      readonly add?: NavigationTarget;
    };

/** A user's explicit open or close of an optional static placement. */
export type StaticPlacementOverride = "open" | "closed";

export interface OwnedResourceInstance {
  instanceKey: string;
  resource: ResourceRef;
  open?: PageOpenIntent;
  title?: string;
}

export interface OwnedPlacementState {
  staticOverrides: Map<string, StaticPlacementOverride>;
  resourceInstances: Map<string, readonly OwnedResourceInstance[]>;
}

export const createOwnedPlacementState = (): OwnedPlacementState => ({
  staticOverrides: new Map(),
  resourceInstances: new Map(),
});

export const isStaticPlacementOpen = (item: WorkbenchOwnedPlacementItem, state: OwnedPlacementState, id: string) => {
  if (item.kind !== "view") return false;
  if (item.presence === "fixed") return true;
  return (state.staticOverrides.get(id) ?? item.presence) === "open";
};

export const staticPlacementClosable = (item: WorkbenchOwnedPlacementItem) =>
  item.kind !== "view" || item.presence !== "fixed";

export const validateOwnedPlacementItem = (label: string, id: string, item: WorkbenchOwnedPlacementItem) => {
  if (item.kind === "resource" && item.resourceKinds.length === 0) {
    throw new Error(`${label} "${id}" must bind at least one resource kind`);
  }
};

export const openStaticPlacement = (input: {
  label: string;
  id: string;
  item: WorkbenchOwnedPlacementItem;
  state: OwnedPlacementState;
  resource?: ResourceRef;
  open?: PageOpenIntent;
}) => {
  const { id, item, label, state } = input;
  if (item.kind !== "view") throw new Error(`${label} "${id}" is not a static placement`);
  if (input.resource) throw new Error(`${label} "${id}" does not accept a resource`);
  if (input.open) throw new Error(`${label} "${id}" does not accept an open intent`);
  if (item.presence !== "fixed") state.staticOverrides.set(id, "open");
};

export const closeStaticPlacement = (input: {
  label: string;
  id: string;
  item: WorkbenchOwnedPlacementItem;
  state: OwnedPlacementState;
}) => {
  const { id, item, label, state } = input;
  if (item.kind !== "view") throw new Error(`${label} "${id}" is not a static placement`);
  if (item.presence === "fixed") throw new Error(`${label} "${id}" is fixed and cannot close`);
  state.staticOverrides.set(id, "closed");
};

const retainResourceInstances = (
  item: Extract<WorkbenchOwnedPlacementItem, { kind: "resource" }>,
  current: readonly OwnedResourceInstance[],
  next: OwnedResourceInstance,
): readonly OwnedResourceInstance[] => {
  if (item.cardinality === "one") return [next];
  const existing = current.find((candidate) => candidate.instanceKey === next.instanceKey);
  const open: PageOpenIntent = existing?.open === "pin" || next.open === "pin" ? "pin" : "preview";
  const retained = current.filter(
    (candidate) => candidate.instanceKey !== next.instanceKey && (open === "pin" || candidate.open === "pin"),
  );
  return [...retained, { ...next, open }];
};

export const openResourcePlacement = (input: {
  label: string;
  id: string;
  item: WorkbenchOwnedPlacementItem;
  state: OwnedPlacementState;
  resource?: ResourceRef;
  open?: PageOpenIntent;
  title?: string;
}) => {
  const { id, item, label, state } = input;
  if (item.kind !== "resource") throw new Error(`${label} "${id}" is not resource-backed`);
  if (!input.resource) throw new Error(`${label} "${id}" requires a resource`);
  if (!item.resourceKinds.includes(input.resource.kind)) {
    throw new Error(`${label} "${id}" does not accept resource kind "${input.resource.kind}"`);
  }
  if (input.open && item.cardinality !== "many") {
    throw new Error(`${label} "${id}" accepts open intent only with many cardinality`);
  }
  const instance: OwnedResourceInstance = {
    instanceKey: input.resource.uri,
    resource: input.resource,
    ...(item.cardinality === "many" ? { open: input.open ?? ("preview" as const) } : {}),
    ...(input.title ? { title: input.title } : {}),
  };
  state.resourceInstances.set(id, retainResourceInstances(item, state.resourceInstances.get(id) ?? [], instance));
  return instance.instanceKey;
};

export const closeOwnedPlacementInstance = (input: {
  label: string;
  id: string;
  item: WorkbenchOwnedPlacementItem;
  state: OwnedPlacementState;
  instanceKey: string;
}) => {
  if (input.instanceKey === "default") {
    closeStaticPlacement(input);
    return true;
  }
  const current = input.state.resourceInstances.get(input.id) ?? [];
  const next = current.filter((instance) => instance.instanceKey !== input.instanceKey);
  if (next.length === current.length) return false;
  input.state.resourceInstances.set(input.id, next);
  return true;
};

export const updateResourcePlacementInstance = (input: {
  label: string;
  id: string;
  item: WorkbenchOwnedPlacementItem;
  state: OwnedPlacementState;
  instanceKey: string;
  resource?: ResourceRef;
  title?: string;
}) => {
  const { id, item, label, state } = input;
  if (input.instanceKey === "default" || item.kind !== "resource") return;
  if (input.resource && !item.resourceKinds.includes(input.resource.kind)) {
    throw new Error(`${label} "${id}" does not accept resource kind "${input.resource.kind}"`);
  }
  const instances = state.resourceInstances.get(id) ?? [];
  state.resourceInstances.set(
    id,
    instances.map((instance) =>
      instance.instanceKey === input.instanceKey
        ? {
            ...instance,
            ...(input.resource ? { resource: input.resource } : {}),
            ...(input.title === undefined ? {} : { title: input.title }),
          }
        : instance,
    ),
  );
};

export const clearOwnedPlacementState = (state: OwnedPlacementState, id: string) => {
  state.staticOverrides.delete(id);
  state.resourceInstances.delete(id);
};
