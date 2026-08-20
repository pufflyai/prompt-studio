import type {
  ModePlacementContribution,
  ModeResourceRecipeContribution,
  ResourceHierarchyProvider,
  ResourceKindContribution,
  ResourcePanelContribution,
} from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimePanelRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import {
  contributionId,
  resolveContributionReference,
  resolveResourceKindReference,
  resourceKindReferences,
} from "./references";

const recordBase = (ext: NormalizedExtension, source: LoadedExtensionSource, localId: string) => ({
  id: contributionId(ext, localId),
  localId,
  extensionId: ext.id,
  name: ext.name,
  sourcePath: source.sourcePath,
});

export const collectCompositionContributions = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.resourceKinds ?? {})) {
    if (!isRecord(contribution) || !isRecord(contribution.slots) || typeof contribution.surface !== "string") continue;
    runtime.resourceKinds.push({
      ...recordBase(ext, source, localId),
      // A resource kind keeps the plain name it was declared with. See
      // `resolveResourceKindReference` for why the host must not namespace it.
      id: localId,
      contribution: contribution as unknown as ResourceKindContribution,
    });
  }

  for (const [localId, contribution] of Object.entries(source.definition.resourcePanels ?? {})) {
    if (
      !isRecord(contribution) ||
      typeof contribution.resourceKind !== "string" ||
      typeof contribution.panel !== "string" ||
      typeof contribution.slot !== "string"
    ) {
      continue;
    }
    runtime.resourcePanels.push({
      ...recordBase(ext, source, localId),
      // Kept as written: resource kinds are resolved once every extension is
      // collected, so a cross-extension edge does not depend on source order.
      resourceKindId: contribution.resourceKind,
      panelId: resolveContributionReference(ext, contribution.panel),
      slotId: contribution.slot,
      contribution: contribution as unknown as ResourcePanelContribution,
    });
  }

  for (const [localId, provider] of Object.entries(source.definition.resourceHierarchyProviders ?? {})) {
    if (!isRecord(provider) || typeof provider.resourceKind !== "string" || typeof provider.parent !== "function")
      continue;
    runtime.resourceHierarchyProviders.push({
      ...recordBase(ext, source, localId),
      resourceKindId: provider.resourceKind,
      provider: provider as unknown as ResourceHierarchyProvider,
    });
  }
};

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

const panelRegions = (panel: RuntimePanelRecord) => panel.contribution.supportedRegions;

const validatesPanelPlacement = (
  runtime: Accumulator,
  mode: { extensionId: string; sourcePath: string; id: string },
  panelId: string,
  placement: ModePlacementContribution,
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
  const unsupported = [placement.region, ...(placement.allowedRegions ?? [])].find(
    (region) => !panelRegions(panel).includes(region),
  );
  if (unsupported) {
    addDiagnostic(
      runtime,
      mode,
      "extension_panel_region_unsupported",
      `${panelId}:${unsupported}`,
      `Panel "${panelId}" does not support region "${unsupported}"`,
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

// A slot placement is valid when the resource kind declares the slot; `required`
// only holds for a single-cardinality slot. Every edge in the slot must also be
// placeable in the requested region.
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
  for (const edge of runtime.resourcePanels.filter(
    (candidate) => candidate.resourceKindId === args.kindId && candidate.slotId === args.slotId,
  )) {
    validatesPanelPlacement(runtime, args.mode, edge.panelId, args.placement);
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
  if (!edge) {
    const panelExists = runtime.panels.some((candidate) => candidate.id === panelId);
    addDiagnostic(
      runtime,
      args.mode,
      panelExists ? "extension_mode_resource_unsupported" : "extension_panel_missing",
      panelId,
      `Panel "${panelId}" is not registered for resource kind "${args.kindId}"`,
    );
    return;
  }
  validatesPanelPlacement(runtime, args.mode, panelId, args.placement);
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
    const slotMain = Object.entries(recipe.slots ?? {}).filter(
      ([slotId, placement]) => slotId === "primary" && placement.region === "main",
    ).length;
    const panelMain = Object.entries(recipe.panels ?? {}).filter(([rawPanelId, placement]) => {
      const panelId = resolveContributionReference(ext, rawPanelId);
      return (
        placement.region === "main" &&
        runtime.resourcePanels.some(
          (candidate) =>
            candidate.resourceKindId === kindId && candidate.panelId === panelId && candidate.slotId === "primary",
        )
      );
    }).length;
    if (slotMain + panelMain !== 1) {
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

// Resource kind references resolve after every extension is collected, so a
// cross-extension reference is independent of source order.
const resolveResourceKindReferences = (runtime: Accumulator) => {
  const references = resourceKindReferences(runtime.resourceKinds);
  runtime.resourcePanels = runtime.resourcePanels.map((edge) => ({
    ...edge,
    resourceKindId: resolveResourceKindReference(edge.resourceKindId, references),
  }));
  runtime.resourceHierarchyProviders = runtime.resourceHierarchyProviders.map((provider) => ({
    ...provider,
    resourceKindId: resolveResourceKindReference(provider.resourceKindId, references),
  }));
  return references;
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
  const references = resolveResourceKindReferences(runtime);
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

  for (const mode of runtime.modes) {
    const ext = runtime.extensions.find((candidate) => candidate.id === mode.extensionId);
    if (!ext) continue;
    for (const [resourceKind, recipe] of Object.entries(mode.contribution.resources ?? {})) {
      validateModeRecipe(runtime, mode, resolveResourceKindReference(resourceKind, references), recipe);
    }
    for (const [panelReference, placement] of Object.entries(mode.contribution.modePanels ?? {})) {
      validatesPanelPlacement(runtime, mode, resolveContributionReference(ext, panelReference), placement);
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
