import type { PageOpenIntent, PlacementIdentity, PlacementRef, ResourceRef } from "@pstdio/sdk/extensions";
import type { Disposable } from "../../shared/disposable";
import type { DockedCompositionRegion } from "../layout/composition-resolver-types";
import type { WorkbenchWidgetPlacement } from "../layout/layout-types";
import type { WorkbenchPlacementOwnerState } from "../layout/owned-placement-state";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";

export type WorkbenchModePlacementItem =
  | { readonly kind: "view"; readonly viewId: string }
  | {
      readonly kind: "resource";
      readonly viewId: string;
      readonly resourceKind: string;
      readonly cardinality: "one" | "many";
    };

export interface WorkbenchModePlacementContribution {
  readonly id: string;
  readonly ref: PlacementRef;
  readonly modeId: string;
  readonly item: WorkbenchModePlacementItem;
  readonly region: DockedCompositionRegion;
  readonly order?: number;
  readonly defaultOpen?: boolean;
  readonly required?: boolean;
  readonly movableTo?: readonly DockedCompositionRegion[];
}

export interface WorkbenchModePanelResolution {
  identity: PlacementIdentity;
  placements: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
}

export interface WorkbenchModePanelTarget {
  modeId: string;
  panel: PlacementRef;
  resource?: ResourceRef;
  open?: PageOpenIntent;
  current: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
}

export interface WorkbenchModePlacementRegistry {
  registerPlacement(placement: WorkbenchModePlacementContribution): Disposable;
  listPlacements(modeId?: string): WorkbenchModePlacementContribution[];
  resolvePlacements(
    modeId: string,
    current?: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
    ownerState?: WorkbenchPlacementOwnerState,
  ): readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
  resolvePanelTarget(input: WorkbenchModePanelTarget): WorkbenchModePanelResolution;
  resolvePlacementState(
    modeId: string,
    placements: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
  ): WorkbenchPlacementOwnerState;
  closePlacement(input: {
    modeId: string;
    identity: PlacementIdentity;
    current: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
  }): readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
  onDidChange(listener: () => void): Disposable;
}
