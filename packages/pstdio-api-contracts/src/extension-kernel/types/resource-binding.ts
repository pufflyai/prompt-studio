import type { ResourceKindRef, ViewRef } from "./contribution-identity";
import type { NavigationTarget } from "./navigation-target";

export interface ResourceConstraint {
  readonly kinds: readonly ResourceKindRef[];
}

export interface ResourceBinding extends ResourceConstraint {
  readonly view: ViewRef;
  readonly cardinality: "one" | "many";
  readonly add?: NavigationTarget;
}
