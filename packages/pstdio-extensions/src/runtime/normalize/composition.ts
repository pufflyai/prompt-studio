import { createDiagnostic } from "../diagnostics";
import type { Accumulator } from "./accumulator";
import { resolveCompositionResourceKindReferences } from "./composition-collection";
import { resolveResourceKindReference } from "./references";

export { collectCompositionContributions } from "./composition-collection";

const addDiagnostic = (
  runtime: Accumulator,
  record: { extensionId: string; sourcePath: string; id: string },
  code: string,
  failedReference: string,
  message: string,
) => {
  runtime.diagnostics.push(
    createDiagnostic({
      code,
      message,
      extensionId: record.extensionId,
      sourcePath: record.sourcePath,
      metadata: { contributionId: record.id, failedReference },
    }),
  );
};

const validateResourceViews = (runtime: Accumulator) => {
  const valid = [] as typeof runtime.resourceViews;
  for (const edge of runtime.resourceViews) {
    const kind = runtime.resourceKinds.find((candidate) => candidate.id === edge.resourceKindId);
    const view = runtime.views.find((candidate) => candidate.id === edge.viewId);
    if (!kind) {
      addDiagnostic(
        runtime,
        edge,
        "extension_resource_kind_missing",
        edge.resourceKindId,
        `Unknown resource kind "${edge.resourceKindId}"`,
      );
      continue;
    }
    if (!view) {
      addDiagnostic(runtime, edge, "extension_view_missing", edge.viewId, `Unknown view "${edge.viewId}"`);
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
        `Slot "${edge.slotId}" is closed to external views`,
      );
      continue;
    }
    valid.push(edge);
  }
  runtime.resourceViews = valid;
};

const validateResourceSlotPlacements = (runtime: Accumulator, references: ReadonlyMap<string, string>) => {
  for (const placement of runtime.placements) {
    const item = placement.contribution.item;
    if (item.kind !== "resource-slot") continue;
    const rawKindId = `${item.slot.resourceKind.extensionId}.${item.slot.resourceKind.id}`;
    const kindId = resolveResourceKindReference(rawKindId, references);
    const kind = runtime.resourceKinds.find((candidate) => candidate.id === kindId);
    if (!kind) {
      addDiagnostic(
        runtime,
        placement,
        "extension_resource_kind_missing",
        rawKindId,
        `Unknown resource kind "${rawKindId}"`,
      );
      continue;
    }
    const slot = kind.contribution.slots[item.slot.id];
    if (!slot) {
      addDiagnostic(
        runtime,
        placement,
        "extension_resource_slot_missing",
        item.slot.id,
        `Unknown slot "${item.slot.id}"`,
      );
      continue;
    }
    if (placement.contribution.required && slot.cardinality === "many") {
      addDiagnostic(
        runtime,
        placement,
        "extension_placement_required_invalid",
        item.slot.id,
        `Required slot "${item.slot.id}" has cardinality many`,
      );
    }
  }
};

const validateResourceKindOwnership = (runtime: Accumulator) => {
  const owners = new Map<string, (typeof runtime.resourceKinds)[number]>();
  for (const kind of runtime.resourceKinds) {
    const owner = owners.get(kind.id);
    if (!owner) {
      owners.set(kind.id, kind);
      continue;
    }
    addDiagnostic(
      runtime,
      kind,
      "extension_resource_kind_duplicate",
      kind.id,
      `Resource kind "${kind.id}" is already declared by extension "${owner.name}"`,
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
        Object.keys(kind.contribution.slots).filter((slotId) => slotId === "primary").length !== 1)
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

  validateResourceViews(runtime);
  validateResourceSlotPlacements(runtime, references);

  for (const provider of runtime.resourceHierarchyProviders) {
    if (runtime.resourceKinds.some((kind) => kind.id === provider.resourceKindId)) continue;
    addDiagnostic(
      runtime,
      provider,
      "extension_resource_kind_missing",
      provider.resourceKindId,
      `Unknown resource kind "${provider.resourceKindId}"`,
    );
  }
};
