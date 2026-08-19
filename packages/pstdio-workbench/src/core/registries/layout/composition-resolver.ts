import type {
  CompositionDiagnostic,
  CompositionModeRecipe,
  CompositionPlacementPolicy,
  DockedCompositionRegion,
  ResolveCompositionInput,
  ResolvedComposition,
  ResolvedCompositionPlacement,
} from "./composition-resolver-types";

interface PlacementCandidate {
  panelId: string;
  slot?: string;
  policy: CompositionPlacementPolicy;
  required: boolean;
}

const intersectRegions = (
  supported: readonly DockedCompositionRegion[],
  requested: readonly DockedCompositionRegion[],
) => requested.filter((region) => supported.includes(region));

// Collects the placement candidates a recipe requests for the active context, in
// declaration order: resource slot placements, then known-panel overrides, then
// mode-wide panels. A panel entry wins over its slot placement.
const collectCandidates = (
  input: ResolveCompositionInput,
  recipe: CompositionModeRecipe | undefined,
  diagnostics: CompositionDiagnostic[],
) => {
  const { composition, context } = input;
  const kind = composition.resourceKinds.find((candidate) => candidate.id === context.resourceKind);
  const candidates: PlacementCandidate[] = [];
  const validEdges = composition.resourcePanels.filter((edge) => {
    if (!kind || edge.resourceKind !== kind.id) return false;
    const slot = kind.slots[edge.slot];
    if (!slot) {
      diagnostics.push({
        code: "extension_resource_slot_missing",
        message: `Resource panel "${edge.id}" names unknown slot "${edge.slot}"`,
        panelId: edge.panel,
        slot: edge.slot,
      });
      return false;
    }
    if (edge.extensionId !== kind.extensionId && (!slot.external || edge.slot === "primary")) {
      diagnostics.push({
        code: "extension_resource_slot_closed",
        message: `Slot "${edge.slot}" is closed to external panels`,
        panelId: edge.panel,
        slot: edge.slot,
      });
      return false;
    }
    if (!composition.panels.some((panel) => panel.id === edge.panel)) {
      diagnostics.push({
        code: "extension_panel_missing",
        message: `Resource panel "${edge.id}" names unknown panel "${edge.panel}"`,
        panelId: edge.panel,
        slot: edge.slot,
      });
      return false;
    }
    return true;
  });

  const overriddenPanels = new Set(Object.keys(recipe?.panels ?? {}));

  for (const [slotName, policy] of Object.entries(recipe?.slots ?? {})) {
    const slot = kind?.slots[slotName];
    if (!slot) {
      diagnostics.push({
        code: "extension_resource_slot_missing",
        message: `Mode "${input.mode.id}" places unknown slot "${slotName}"`,
        slot: slotName,
      });
      continue;
    }
    const required = policy.required === true;
    if (required && slot.cardinality === "many") {
      diagnostics.push({
        code: "extension_placement_required_invalid",
        message: `Required slot "${slotName}" has cardinality many; name a specific panel instead`,
        slot: slotName,
      });
    }
    for (const edge of validEdges.filter((candidate) => candidate.slot === slotName)) {
      if (overriddenPanels.has(edge.panel)) continue;
      candidates.push({
        panelId: edge.panel,
        slot: slotName,
        policy,
        required: required && slot.cardinality === "one",
      });
    }
  }

  for (const [panelId, policy] of Object.entries(recipe?.panels ?? {})) {
    const edge = validEdges.find((candidate) => candidate.panel === panelId);
    if (!edge) {
      diagnostics.push({
        code: "extension_panel_missing",
        message: `Mode "${input.mode.id}" places panel "${panelId}" that is not registered for the resource`,
        panelId,
      });
      continue;
    }
    candidates.push({ panelId, slot: edge.slot, policy, required: policy.required === true });
  }

  for (const [panelId, policy] of Object.entries(input.mode.modePanels ?? {})) {
    if (!composition.panels.some((panel) => panel.id === panelId)) {
      diagnostics.push({
        code: "extension_panel_missing",
        message: `Mode "${input.mode.id}" places unknown mode-wide panel "${panelId}"`,
        panelId,
      });
      continue;
    }
    candidates.push({ panelId, policy, required: policy.required === true });
  }

  return { candidates, validEdges };
};

// Applies the panel-capability boundary: a recipe cannot expand a panel's supported
// regions. Returns the resolved placement or undefined when the region is invalid.
const resolveCandidate = (
  input: ResolveCompositionInput,
  candidate: PlacementCandidate,
  diagnostics: CompositionDiagnostic[],
): ResolvedCompositionPlacement | undefined => {
  const panel = input.composition.panels.find((definition) => definition.id === candidate.panelId);
  if (!panel) return undefined;
  const allowed = intersectRegions(panel.supportedRegions, [
    candidate.policy.region,
    ...(candidate.policy.allowedRegions ?? []),
  ]);
  if (!allowed.includes(candidate.policy.region)) {
    diagnostics.push({
      code: "extension_panel_region_unsupported",
      message: `Panel "${candidate.panelId}" does not support region "${candidate.policy.region}"`,
      panelId: candidate.panelId,
    });
    return undefined;
  }
  return {
    panelId: candidate.panelId,
    region: candidate.policy.region,
    slot: candidate.slot,
    required: candidate.required,
    closable: !candidate.required,
    allowedRegions: allowed,
    origin: candidate.required ? "required" : "default",
  };
};

// Resolves one effective layout for the active mode-resource context:
//  1. confirm the mode accepts the resource kind;
//  2. collect the kind's slots and valid resource-panel contributions;
//  3. apply the mode-wide and resource placement recipes;
//  4. keep only regions allowed by both panel capability and recipe;
//  5. restore valid persisted placements and tab order;
//  6. restore missing required placements;
//  7. seed default placements only when no layout exists for the scope;
//  8. expose remaining valid optional panels for Add Panel.
export const resolveComposition = (input: ResolveCompositionInput): ResolvedComposition => {
  const diagnostics: CompositionDiagnostic[] = [];
  const { context, mode } = input;

  const recipe = context.resourceKind ? mode.resources?.[context.resourceKind] : undefined;
  if (context.resourceKind && !recipe) {
    diagnostics.push({
      code: "extension_mode_resource_unsupported",
      message: `Mode "${mode.id}" does not accept resource kind "${context.resourceKind}"`,
    });
    return { placements: [], regionOrder: {}, activePanelIds: {}, optionalPanels: [], diagnostics };
  }

  const { candidates, validEdges } = collectCandidates(input, recipe, diagnostics);
  const resolvedByPanel = new Map<string, ResolvedCompositionPlacement>();
  let requiredFallback: { panelId: string } | undefined;

  for (const candidate of candidates) {
    const resolved = resolveCandidate(input, candidate, diagnostics);
    if (resolved) {
      if (!resolvedByPanel.has(resolved.panelId)) resolvedByPanel.set(resolved.panelId, resolved);
      continue;
    }
    if (!candidate.required) continue;
    // An unresolvable required placement keeps the workbench usable: fall back to
    // the first panel that can establish the main location.
    const fallbackPanel = input.composition.panels.find((panel) => panel.supportedRegions.includes("main"));
    if (fallbackPanel) requiredFallback = { panelId: fallbackPanel.id };
  }

  const placements: ResolvedCompositionPlacement[] = [];
  const regionOrder: Partial<Record<DockedCompositionRegion, string[]>> = {};
  const activePanelIds: Partial<Record<DockedCompositionRegion, string>> = {};
  const placed = new Set<string>();

  const place = (placement: ResolvedCompositionPlacement, region: DockedCompositionRegion) => {
    if (placed.has(placement.panelId)) return;
    placed.add(placement.panelId);
    placements.push({ ...placement, region });
    regionOrder[region] = [...(regionOrder[region] ?? []), placement.panelId];
  };

  if (input.persisted) {
    // Valid persisted user placements win over defaults: keep the user's region
    // choice when the panel allows it, and keep the persisted tab order.
    for (const [region, state] of Object.entries(input.persisted.regions) as [
      DockedCompositionRegion,
      { order: readonly string[]; activePanelId?: string },
    ][]) {
      if (!state) continue;
      for (const panelId of state.order) {
        const resolved = resolvedByPanel.get(panelId);
        if (!resolved) continue;
        const region_ = resolved.allowedRegions.includes(region) ? region : resolved.region;
        place({ ...resolved, origin: "persisted" }, region_);
      }
      if (state.activePanelId && placed.has(state.activePanelId)) {
        activePanelIds[region] = state.activePanelId;
      }
    }
    // Missing required structure is restored without resetting optional user state.
    for (const resolved of resolvedByPanel.values()) {
      if (resolved.required && !placed.has(resolved.panelId)) place(resolved, resolved.region);
    }
  } else {
    for (const resolved of resolvedByPanel.values()) place(resolved, resolved.region);
  }

  const optionalPanels = validEdges
    .map((edge) => edge.panel)
    .filter((panelId, index, all) => all.indexOf(panelId) === index)
    .filter((panelId) => !placed.has(panelId))
    .filter((panelId) => {
      const panel = input.composition.panels.find((definition) => definition.id === panelId);
      return panel !== undefined && panel.supportedRegions.length > 0;
    });

  return { placements, regionOrder, activePanelIds, optionalPanels, diagnostics, requiredFallback };
};
