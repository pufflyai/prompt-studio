export const dockedCompositionRegions = ["sidenav", "main", "secondary", "side"] as const;
export type DockedCompositionRegion = (typeof dockedCompositionRegions)[number];

export interface CompositionSlotDefinition {
  cardinality: "one" | "many";
  external: boolean;
}

export interface CompositionResourceKindDefinition {
  id: string;
  extensionId: string;
  surface: "primary" | "secondary" | "attached";
  slots: Record<string, CompositionSlotDefinition>;
}

export interface CompositionPanelDefinition {
  id: string;
  extensionId: string;
  title: string;
  icon?: string;
  supportedRegions: readonly DockedCompositionRegion[];
}

export interface CompositionResourcePanelEdge {
  id: string;
  extensionId: string;
  resourceKind: string;
  panel: string;
  slot: string;
}

export interface CompositionPlacementPolicy {
  region: DockedCompositionRegion;
  allowedRegions?: readonly DockedCompositionRegion[];
  required?: boolean;
}

export interface CompositionModeRecipe {
  slots?: Record<string, CompositionPlacementPolicy>;
  panels?: Record<string, CompositionPlacementPolicy>;
}

export interface CompositionModeDefinition {
  id: string;
  resources?: Record<string, CompositionModeRecipe>;
  modePanels?: Record<string, CompositionPlacementPolicy>;
}

export interface WorkbenchComposition {
  resourceKinds: readonly CompositionResourceKindDefinition[];
  panels: readonly CompositionPanelDefinition[];
  resourcePanels: readonly CompositionResourcePanelEdge[];
}

export interface PersistedCompositionRegionState {
  order: readonly string[];
  activePanelId?: string;
}

// The user-owned half of resolution: which panels are open in which region, in which
// tab order. A panel absent from every region was closed by the user. `undefined`
// persisted layout means the scope is new and defaults may seed.
export interface PersistedCompositionLayout {
  regions: Partial<Record<DockedCompositionRegion, PersistedCompositionRegionState>>;
}

export interface CompositionResolutionContext {
  modeId: string;
  resourceKind?: string;
}

export interface ResolveCompositionInput {
  context: CompositionResolutionContext;
  mode: CompositionModeDefinition;
  composition: WorkbenchComposition;
  persisted?: PersistedCompositionLayout;
}

export interface ResolvedCompositionPlacement {
  panelId: string;
  region: DockedCompositionRegion;
  slot?: string;
  required: boolean;
  closable: boolean;
  allowedRegions: readonly DockedCompositionRegion[];
  origin: "persisted" | "required" | "default";
}

export interface ResolvedCompositionAddablePanel {
  panelId: string;
  region: DockedCompositionRegion;
  allowedRegions: readonly DockedCompositionRegion[];
}

export interface CompositionDiagnostic {
  code:
    | "extension_resource_kind_missing"
    | "extension_resource_slot_missing"
    | "extension_resource_slot_closed"
    | "extension_panel_missing"
    | "extension_panel_region_unsupported"
    | "extension_mode_resource_unsupported"
    | "extension_placement_required_invalid"
    | "extension_resource_primary_invalid";
  message: string;
  panelId?: string;
  slot?: string;
}

export interface ResolvedComposition {
  placements: readonly ResolvedCompositionPlacement[];
  regionOrder: Partial<Record<DockedCompositionRegion, readonly string[]>>;
  activePanelIds: Partial<Record<DockedCompositionRegion, string>>;
  addablePanels: readonly ResolvedCompositionAddablePanel[];
  optionalPanels: readonly string[];
  diagnostics: readonly CompositionDiagnostic[];
  // The safest main placement when a required placement cannot be resolved.
  requiredFallback?: { panelId: string };
}
