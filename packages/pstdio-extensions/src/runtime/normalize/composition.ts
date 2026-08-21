import type {
  ModePlacementContribution,
  ModeResourceRecipeContribution,
  PanelPlacementContribution,
} from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimePanelRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { Accumulator } from "./accumulator";
import { resolveCompositionResourceKindReferences } from "./composition-collection";
import { resolveContributionReference, resolveResourceKindReference } from "./references";

export { collectCompositionContributions } from "./composition-collection";

const addDiagnostic = (
  runtime: Accumulator,
  record: { extensionId: string; sourcePath: string; id: string },
  code: string,
  failedReference: string,
  message: string,
  severity: "error" | "warning" = "error",
) => {
  runtime.diagnostics.push(
    createDiagnostic({
      code,
      severity,
      message,
      extensionId: record.extensionId,
      sourcePath: record.sourcePath,
      metadata: { contributionId: record.id, failedReference },
    }),
  );
};

// A namespaced reference to an extension that is not installed is inert, not an
// authoring mistake: extensions install independently, so a cross-extension
// contribution simply contributes nothing until its target is present. A
// reference into an extension that IS present stays an error.
const referencesAbsentExtension = (runtime: Accumulator, reference: string) => {
  const prefix = reference.split(".")[0];
  if (!prefix || !reference.includes(".")) return false;
  return !runtime.extensions.some((extension) => extension.name === prefix);
};

const panelPlacements = (panel: RuntimePanelRecord) => {
  const show = panel.contribution.show;
  if (!show) return [];
  return Array.isArray(show) ? show : [show];
};

const placementRegions = (placement: ModePlacementContribution) => [
  placement.region,
  ...(placement.allowedRegions ?? []),
];

const panelPlacementFor = (panel: RuntimePanelRecord, resourceKind: string | undefined) =>
  panelPlacements(panel).find((placement) => placement.for === resourceKind);

const validatesPanelPlacement = (
  runtime: Accumulator,
  mode: { extensionId: string; sourcePath: string; id: string },
  panelId: string,
  placement: ModePlacementContribution,
  base?: PanelPlacementContribution,
) => {
  const panel = runtime.panels.find((candidate) => candidate.id === panelId);
  if (!panel) {
    addDiagnostic(
      runtime,
      mode,
      "extension_panel_missing",
      panelId,
      `Mode "${mode.id}" references unknown panel "${panelId}"`,
    );
    return false;
  }
  const allowed = base ? placementRegions(base) : placementRegions(placement);
  const unsupported = placementRegions(placement).find((region) => !allowed.includes(region));
  if (unsupported) {
    addDiagnostic(
      runtime,
      mode,
      "extension_panel_placement_unresolvable",
      `${panelId}:${unsupported}`,
      `Panel "${panelId}" cannot be placed in region "${unsupported}"`,
    );
    return false;
  }
  return true;
};

const validateResourcePanels = (runtime: Accumulator) => {
  const valid = [] as typeof runtime.resourcePanels;
  for (const edge of runtime.resourcePanels) {
    const kind = runtime.resourceKinds.find((candidate) => candidate.id === edge.resourceKindId);
    const panel = runtime.panels.find((candidate) => candidate.id === edge.panelId);
    if (!kind) {
      const absent = referencesAbsentExtension(runtime, edge.resourceKindId);
      addDiagnostic(
        runtime,
        edge,
        "extension_resource_kind_missing",
        edge.resourceKindId,
        absent
          ? `Resource kind "${edge.resourceKindId}" is not installed; this contribution is inactive`
          : `Unknown resource kind "${edge.resourceKindId}"`,
        absent ? "warning" : "error",
      );
      continue;
    }
    if (!panel) {
      addDiagnostic(runtime, edge, "extension_panel_missing", edge.panelId, `Unknown panel "${edge.panelId}"`);
      continue;
    }
    const slot = kind.contribution.slots[edge.slotId];
    if (!slot) {
      addDiagnostic(runtime, edge, "extension_resource_slot_missing", edge.slotId, `Unknown slot "${edge.slotId}"`);
      continue;
    }
    if (edge.extensionId !== kind.extensionId && (!slot.external || edge.slotId === "primary")) {
      addDiagnostic(
        runtime,
        edge,
        "extension_resource_slot_closed",
        edge.slotId,
        `Slot "${edge.slotId}" is closed to external panels`,
      );
      continue;
    }
    valid.push(edge);
  }
  runtime.resourcePanels = valid;
};

// A slot placement is valid when the resource kind declares the slot. A cross-extension
// edge gets its region from the slot, so it has no second panel-region contract to check.
const validateSlotPlacement = (
  runtime: Accumulator,
  args: {
    kind: (typeof runtime.resourceKinds)[number];
    kindId: string;
    mode: (typeof runtime.modes)[number];
    placement: ModePlacementContribution;
    slotId: string;
  },
) => {
  const slot = args.kind.contribution.slots[args.slotId];
  if (!slot) {
    addDiagnostic(
      runtime,
      args.mode,
      "extension_resource_slot_missing",
      args.slotId,
      `Mode "${args.mode.id}" references unknown slot "${args.slotId}"`,
    );
    return;
  }
  if (args.placement.required && slot.cardinality === "many") {
    addDiagnostic(
      runtime,
      args.mode,
      "extension_placement_required_invalid",
      args.slotId,
      `Required slot "${args.slotId}" has cardinality many`,
    );
  }
};

// A known-panel entry may only place a panel that is registered for the resource.
const validateKnownPanelPlacement = (
  runtime: Accumulator,
  args: {
    ext: NormalizedExtension;
    kindId: string;
    mode: (typeof runtime.modes)[number];
    placement: ModePlacementContribution;
    rawPanelId: string;
  },
) => {
  const panelId = resolveContributionReference(args.ext, args.rawPanelId);
  const edge = runtime.resourcePanels.find(
    (candidate) => candidate.resourceKindId === args.kindId && candidate.panelId === panelId,
  );
  const panel = runtime.panels.find((candidate) => candidate.id === panelId);
  const kind = runtime.resourceKinds.find((candidate) => candidate.id === args.kindId);
  const ownPlacement =
    panel && panel.extensionId === kind?.extensionId ? panelPlacementFor(panel, args.kindId) : undefined;
  if (!edge && !ownPlacement) {
    const panelExists = Boolean(panel);
    addDiagnostic(
      runtime,
      args.mode,
      panelExists ? "extension_mode_resource_unsupported" : "extension_panel_missing",
      panelId,
      `Panel "${panelId}" is not registered for resource kind "${args.kindId}"`,
    );
    return;
  }
  validatesPanelPlacement(runtime, args.mode, panelId, args.placement, ownPlacement);
};

const validateModeRecipe = (
  runtime: Accumulator,
  mode: (typeof runtime.modes)[number],
  kindId: string,
  recipe: ModeResourceRecipeContribution,
) => {
  const ext = runtime.extensions.find((candidate) => candidate.id === mode.extensionId);
  if (!ext) return;
  const kind = runtime.resourceKinds.find((candidate) => candidate.id === kindId);
  if (!kind) {
    const absent = referencesAbsentExtension(runtime, kindId);
    addDiagnostic(
      runtime,
      mode,
      "extension_mode_resource_unsupported",
      kindId,
      absent
        ? `Mode "${mode.id}" arranges resource kind "${kindId}", which is not installed`
        : `Mode "${mode.id}" references unsupported resource kind "${kindId}"`,
      absent ? "warning" : "error",
    );
    return;
  }

  for (const [slotId, placement] of Object.entries(recipe.slots ?? {})) {
    validateSlotPlacement(runtime, { kind, kindId, mode, placement, slotId });
  }

  for (const [rawPanelId, placement] of Object.entries(recipe.panels ?? {})) {
    validateKnownPanelPlacement(runtime, { ext, kindId, mode, placement, rawPanelId });
  }

  if (kind.contribution.surface === "primary") {
    const overrides = new Map(
      Object.entries(recipe.panels ?? {}).map(([rawPanelId, placement]) => [
        resolveContributionReference(ext, rawPanelId),
        placement,
      ]),
    );
    const panelMain = runtime.panels.filter((panel) => {
      if (panel.extensionId !== kind.extensionId) return false;
      const placement = panelPlacementFor(panel, kindId);
      return placement && (overrides.get(panel.id) ?? placement).region === "main";
    }).length;
    if (panelMain !== 1) {
      addDiagnostic(
        runtime,
        mode,
        "extension_resource_primary_invalid",
        kindId,
        `Primary resource "${kindId}" must have exactly one main placement`,
      );
    }
  }
};

const validatePanelPlacements = (runtime: Accumulator) => {
  for (const panel of runtime.panels) {
    for (const placement of panelPlacements(panel)) {
      if (!placement.for) continue;
      const kind = runtime.resourceKinds.find((candidate) => candidate.id === placement.for);
      if (kind?.extensionId === panel.extensionId) continue;
      addDiagnostic(
        runtime,
        panel,
        "extension_panel_placement_unresolvable",
        placement.for,
        kind
          ? `Panel "${panel.id}" must use a resource-panel slot to contribute to "${placement.for}"`
          : `Panel "${panel.id}" references unknown resource kind "${placement.for}"`,
      );
    }
  }
};

// A resource kind has exactly one owner. Two extensions declaring the same kind would
// leave the running workbench with one registration and an ambiguous owner, so this is
// an install-time error for both of them.
const validateResourceKindOwnership = (runtime: Accumulator) => {
  for (const kind of runtime.resourceKinds) {
    const owner = runtime.resourceKinds.find((candidate) => candidate.id === kind.id);
    if (owner === kind) continue;
    addDiagnostic(
      runtime,
      kind,
      "extension_resource_kind_duplicate",
      kind.id,
      `Resource kind "${kind.id}" is already declared by extension "${owner?.name}"`,
    );
  }
};

export const validateCompositionRelationships = (runtime: Accumulator) => {
  const references = resolveCompositionResourceKindReferences(runtime);
  validateResourceKindOwnership(runtime);

  for (const kind of runtime.resourceKinds) {
    if (
      kind.contribution.surface === "primary" &&
      (kind.contribution.slots.primary?.cardinality !== "one" ||
        Object.entries(kind.contribution.slots).filter(([slotId]) => slotId === "primary").length !== 1)
    ) {
      addDiagnostic(
        runtime,
        kind,
        "extension_resource_primary_invalid",
        kind.id,
        `Primary resource "${kind.id}" must declare one primary slot with cardinality one`,
      );
    }
  }

  validateResourcePanels(runtime);
  validatePanelPlacements(runtime);

  for (const mode of runtime.modes) {
    const ext = runtime.extensions.find((candidate) => candidate.id === mode.extensionId);
    if (!ext) continue;
    for (const [resourceKind, recipe] of Object.entries(mode.contribution.resources ?? {})) {
      validateModeRecipe(runtime, mode, resolveResourceKindReference(resourceKind, references), recipe);
    }
    for (const [panelReference, placement] of Object.entries(mode.contribution.modePanels ?? {})) {
      const panelId = resolveContributionReference(ext, panelReference);
      const panel = runtime.panels.find((candidate) => candidate.id === panelId);
      validatesPanelPlacement(runtime, mode, panelId, placement, panel && panelPlacementFor(panel, undefined));
    }
  }

  for (const provider of runtime.resourceHierarchyProviders) {
    if (!runtime.resourceKinds.some((kind) => kind.id === provider.resourceKindId)) {
      addDiagnostic(
        runtime,
        provider,
        "extension_resource_kind_missing",
        provider.resourceKindId,
        `Unknown resource kind "${provider.resourceKindId}"`,
      );
    }
  }
};
