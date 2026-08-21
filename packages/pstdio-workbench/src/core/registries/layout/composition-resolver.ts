import type {
  CompositionDiagnostic,
  CompositionModeRecipe,
  CompositionPanelPlacement,
  CompositionPlacementPolicy,
  CompositionResourceKindDefinition,
  DockedCompositionRegion,
  ResolveCompositionInput,
  ResolvedComposition,
  ResolvedCompositionPlacement,
} from "./composition-resolver-types";

interface PlacementCandidate {
  panelId: string;
  slot?: string;
  policy: CompositionPlacementPolicy;
  base?: CompositionPanelPlacement;
  required: boolean;
}

const policyRegions = (policy: CompositionPlacementPolicy) => [
  ...new Set([policy.region, ...(policy.allowedRegions ?? [])]),
];

const panelPlacements = (panel: ResolveCompositionInput["composition"]["panels"][number]) => {
  if (!panel.show) return [];
  return Array.isArray(panel.show) ? panel.show : [panel.show];
};

const isUsableEdge = (
  input: ResolveCompositionInput,
  kind: CompositionResourceKindDefinition | undefined,
  edge: ResolveCompositionInput["composition"]["resourcePanels"][number],
  diagnostics: CompositionDiagnostic[],
) => {
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
  if (!input.composition.panels.some((panel) => panel.id === edge.panel)) {
    diagnostics.push({
      code: "extension_panel_missing",
      message: `Resource panel "${edge.id}" names unknown panel "${edge.panel}"`,
      panelId: edge.panel,
      slot: edge.slot,
    });
    return false;
  }
  return true;
};

const slotCandidates = (args: {
  diagnostics: CompositionDiagnostic[];
  kind: CompositionResourceKindDefinition | undefined;
  input: ResolveCompositionInput;
  overriddenPanels: ReadonlySet<string>;
  policy: CompositionPlacementPolicy;
  slotName: string;
  validEdges: ResolveCompositionInput["composition"]["resourcePanels"];
}): PlacementCandidate[] => {
  const slot = args.kind?.slots[args.slotName];
  if (!slot) {
    args.diagnostics.push({
      code: "extension_resource_slot_missing",
      message: `Mode "${args.input.mode.id}" places unknown slot "${args.slotName}"`,
      slot: args.slotName,
    });
    return [];
  }
  const required = args.policy.required === true;
  if (required && slot.cardinality === "many") {
    args.diagnostics.push({
      code: "extension_placement_required_invalid",
      message: `Required slot "${args.slotName}" has cardinality many; name a specific panel instead`,
      slot: args.slotName,
    });
  }
  return args.validEdges
    .filter((edge) => edge.slot === args.slotName && !args.overriddenPanels.has(edge.panel))
    .filter((edge) => edge.extensionId === args.kind?.extensionId)
    .map((edge) => ({
      panelId: edge.panel,
      slot: args.slotName,
      policy: args.policy,
      required: required && slot.cardinality === "one",
    }));
};

const panelPlacementFor = (
  input: ResolveCompositionInput,
  panel: ResolveCompositionInput["composition"]["panels"][number],
) => {
  const kind = input.composition.resourceKinds.find((candidate) => candidate.id === input.context.resourceKind);
  const placements = panelPlacements(panel);
  const resourcePlacement = placements.find((placement) => placement.resourceKind === input.context.resourceKind);
  if (resourcePlacement && panel.extensionId === kind?.extensionId) return resourcePlacement;
  if (panel.extensionId !== input.mode.extensionId) return undefined;
  return placements.find((placement) => placement.resourceKind === undefined);
};

const collectCandidates = (
  input: ResolveCompositionInput,
  recipe: CompositionModeRecipe | undefined,
  diagnostics: CompositionDiagnostic[],
) => {
  const kind = input.composition.resourceKinds.find((candidate) => candidate.id === input.context.resourceKind);
  const candidates: PlacementCandidate[] = [];
  const validEdges = input.composition.resourcePanels.filter((edge) => isUsableEdge(input, kind, edge, diagnostics));
  const overrides = { ...(recipe?.panels ?? {}), ...(input.mode.modePanels ?? {}) };
  const overriddenPanels = new Set(Object.keys(overrides));

  for (const [slotName, policy] of Object.entries(recipe?.slots ?? {})) {
    candidates.push(...slotCandidates({ diagnostics, kind, input, overriddenPanels, policy, slotName, validEdges }));
  }

  for (const panel of input.composition.panels) {
    const base = panelPlacementFor(input, panel);
    if (!base) continue;
    const policy = overrides[panel.id] ?? base;
    candidates.push({
      panelId: panel.id,
      policy,
      base,
      required: policy.required ?? base.required ?? false,
    });
  }

  const known = new Set(candidates.map((candidate) => candidate.panelId));
  for (const [panelId, policy] of Object.entries(overrides)) {
    if (known.has(panelId)) continue;
    const edge = validEdges.find((candidate) => candidate.panel === panelId);
    const panel = input.composition.panels.find((candidate) => candidate.id === panelId);
    if (!panel || (recipe?.panels?.[panelId] && !edge)) {
      diagnostics.push({
        code: "extension_panel_missing",
        message: `Mode "${input.mode.id}" places panel "${panelId}" that is not registered for the resource`,
        panelId,
      });
      continue;
    }
    candidates.push({ panelId, slot: edge?.slot, policy, required: policy.required === true });
  }

  return { candidates, validEdges };
};

const allowedRegionsFor = (candidate: PlacementCandidate) => {
  const baseRegions = candidate.base ? policyRegions(candidate.base) : policyRegions(candidate.policy);
  if (!candidate.base || !candidate.policy.allowedRegions) return baseRegions;
  return policyRegions(candidate.policy).filter((region) => baseRegions.includes(region));
};

const resolveCandidate = (
  input: ResolveCompositionInput,
  candidate: PlacementCandidate,
  diagnostics: CompositionDiagnostic[],
): ResolvedCompositionPlacement | undefined => {
  const panel = input.composition.panels.find((definition) => definition.id === candidate.panelId);
  if (!panel) return undefined;
  const allowedRegions = allowedRegionsFor(candidate);
  if (!allowedRegions.includes(candidate.policy.region)) {
    diagnostics.push({
      code: "extension_panel_placement_unresolvable",
      message: `Panel "${candidate.panelId}" cannot be placed in region "${candidate.policy.region}"`,
      panelId: candidate.panelId,
    });
    return undefined;
  }
  return {
    panelId: candidate.panelId,
    region: candidate.policy.region,
    slot: candidate.slot,
    required: candidate.required,
    defaultOpen: candidate.required || candidate.policy.defaultOpen !== false,
    pinned: candidate.policy.pinned,
    allowedRegions,
    origin: candidate.required ? "required" : "default",
  };
};

const resolveCandidates = (
  input: ResolveCompositionInput,
  candidates: readonly PlacementCandidate[],
  diagnostics: CompositionDiagnostic[],
) => {
  const resolvedByPanel = new Map<string, ResolvedCompositionPlacement>();
  let requiredFallback: { panelId: string } | undefined;

  for (const candidate of candidates) {
    const resolved = resolveCandidate(input, candidate, diagnostics);
    if (resolved) {
      if (!resolvedByPanel.has(resolved.panelId)) resolvedByPanel.set(resolved.panelId, resolved);
      continue;
    }
    if (candidate.required && allowedRegionsFor(candidate).includes("main")) {
      requiredFallback = { panelId: candidate.panelId };
    }
  }

  return { requiredFallback, resolvedByPanel };
};

type PersistedRegionState = { order: readonly string[]; activePanelId?: string };
type PlaceResolvedPanel = (placement: ResolvedCompositionPlacement, region: DockedCompositionRegion) => void;

const persistedRegions = (persisted: NonNullable<ResolveCompositionInput["persisted"]>) =>
  Object.entries(persisted.regions).filter((entry): entry is [DockedCompositionRegion, PersistedRegionState] =>
    Boolean(entry[1]),
  );

const placePersistedRegions = (input: {
  activePanelIds: Partial<Record<DockedCompositionRegion, string>>;
  persisted: NonNullable<ResolveCompositionInput["persisted"]>;
  place: PlaceResolvedPanel;
  placed: ReadonlySet<string>;
  resolvedByPanel: ReadonlyMap<string, ResolvedCompositionPlacement>;
}) => {
  for (const [region, state] of persistedRegions(input.persisted)) {
    for (const panelId of state.order) {
      const resolved = input.resolvedByPanel.get(panelId);
      if (resolved) {
        input.place(
          { ...resolved, origin: "persisted" },
          resolved.allowedRegions.includes(region) ? region : resolved.region,
        );
      }
    }
    if (state.activePanelId && input.placed.has(state.activePanelId)) {
      input.activePanelIds[region] = state.activePanelId;
    }
  }
};

const placeResolved = (
  input: ResolveCompositionInput,
  resolvedByPanel: ReadonlyMap<string, ResolvedCompositionPlacement>,
) => {
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

  if (!input.persisted) {
    for (const resolved of resolvedByPanel.values()) if (resolved.defaultOpen) place(resolved, resolved.region);
    return { activePanelIds, placed, placements, regionOrder };
  }
  placePersistedRegions({ activePanelIds, persisted: input.persisted, place, placed, resolvedByPanel });
  for (const resolved of resolvedByPanel.values()) {
    if (resolved.required && !placed.has(resolved.panelId)) place(resolved, resolved.region);
  }
  return { activePanelIds, placed, placements, regionOrder };
};

export const resolveComposition = (input: ResolveCompositionInput): ResolvedComposition => {
  const diagnostics: CompositionDiagnostic[] = [];
  const recipe = input.context.resourceKind ? input.mode.resources?.[input.context.resourceKind] : undefined;
  if (input.context.resourceKind && !recipe) {
    diagnostics.push({
      code: "extension_mode_resource_unsupported",
      message: `Mode "${input.mode.id}" does not accept resource kind "${input.context.resourceKind}"`,
    });
    return { placements: [], regionOrder: {}, activePanelIds: {}, addablePanels: [], diagnostics };
  }

  const { candidates, validEdges } = collectCandidates(input, recipe, diagnostics);
  const { requiredFallback, resolvedByPanel } = resolveCandidates(input, candidates, diagnostics);
  const { activePanelIds, placed, placements, regionOrder } = placeResolved(input, resolvedByPanel);
  const addablePanels = Array.from(resolvedByPanel.values())
    .filter((panel) => !panel.required && !placed.has(panel.panelId))
    .map(({ panelId, region, allowedRegions, pinned }) => ({ panelId, region, allowedRegions, pinned }));
  const addablePanelIds = new Set(addablePanels.map((panel) => panel.panelId));

  for (const edge of validEdges) {
    if (placed.has(edge.panel) || addablePanelIds.has(edge.panel)) continue;
    const policy = recipe?.panels?.[edge.panel] ?? recipe?.slots?.[edge.slot];
    if (!policy) continue;
    const resolved = resolveCandidate(
      input,
      { panelId: edge.panel, slot: edge.slot, policy, required: false },
      diagnostics,
    );
    if (!resolved) continue;
    addablePanels.push({
      panelId: resolved.panelId,
      region: resolved.region,
      allowedRegions: resolved.allowedRegions,
      pinned: resolved.pinned,
    });
    addablePanelIds.add(resolved.panelId);
  }

  return { placements, regionOrder, activePanelIds, addablePanels, diagnostics, requiredFallback };
};
