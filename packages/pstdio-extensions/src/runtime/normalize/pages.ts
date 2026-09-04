import type { PageContribution, PageSlot, PageSlotBinding, ResourceKindRef } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimePageSlot } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { isLocalizableString } from "./localizable";
import { normalizeNavigationAction } from "./navigation-action";
import { isPlacementPresentation, removedPlacementField } from "./placement-presentation";
import { registerPrivateHandler } from "./private-handlers";
import { normalizeContributionRef } from "./references";

const isRef = (value: unknown, kind: string) =>
  isRecord(value) &&
  value.kind === kind &&
  typeof value.id === "string" &&
  (value.extensionId === undefined || typeof value.extensionId === "string");

const isPageSlotBinding = (value: unknown) =>
  isRecord(value) &&
  (isRef(value.kind, "resource-kind") ||
    (Array.isArray(value.kind) && value.kind.length > 0 && value.kind.every((kind) => isRef(kind, "resource-kind")))) &&
  isRef(value.view, "view") &&
  (value.cardinality === "one" || value.cardinality === "many") &&
  (value.add === undefined || (isRecord(value.add) && typeof value.add.kind === "string"));

const isOrder = (value: unknown) => value === undefined || (typeof value === "number" && Number.isFinite(value));

const isPresence = (value: unknown) => value === "fixed" || value === "open" || value === "closed";

const isSlotContent = (value: Record<string, unknown>) => {
  if (value.role === "primary") {
    return (
      (value.view === undefined || isRef(value.view, "view")) &&
      (value.binding === undefined || isPageSlotBinding(value.binding)) &&
      value.presence === undefined &&
      value.openOn === undefined
    );
  }
  if (value.view !== undefined) {
    return isRef(value.view, "view") && isPresence(value.presence) && value.binding === undefined;
  }
  return (
    isPageSlotBinding(value.binding) &&
    value.presence === undefined &&
    (value.openOn === undefined || value.openOn === "page-resource")
  );
};

const isPageSlot = (value: unknown): value is PageSlot => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    (value.role !== "primary" && value.role !== "auxiliary") ||
    (value.region !== "main" && value.region !== "secondary" && value.region !== "side")
  ) {
    return false;
  }
  return isSlotContent(value) && isOrder(value.order) && isPlacementPresentation(value);
};

const invalidPageField = (contribution: PageContribution) => {
  if (!isLocalizableString(contribution.title)) return "title";
  if (contribution.icon !== undefined && typeof contribution.icon !== "string") return "icon";
  if (typeof contribution.path !== "string") return "path";
  if (!isRef(contribution.mode, "mode")) return "mode";
  if (contribution.parent !== undefined && !isRef(contribution.parent, "page")) return "parent";
  return undefined;
};

const normalizeBinding = (ext: NormalizedExtension, binding: PageSlotBinding) => ({
  kind: Array.isArray(binding.kind)
    ? binding.kind.map((kind) => normalizeContributionRef(ext, kind))
    : normalizeContributionRef(ext, binding.kind as ResourceKindRef),
  view: normalizeContributionRef(ext, binding.view),
  cardinality: binding.cardinality,
  ...(binding.add ? { add: normalizeNavigationAction(ext, binding.add) } : {}),
});

const normalizeSlot = (input: {
  ext: NormalizedExtension;
  source: LoadedExtensionSource;
  runtime: Accumulator;
  index: RegistryIndex;
  pageId: string;
  slot: PageSlot;
}): RuntimePageSlot => {
  const { tab: _tab, ...slot } = input.slot;
  const queryHandlerId = input.slot.tab
    ? registerPrivateHandler({
        ext: input.ext,
        source: input.source,
        runtime: input.runtime,
        index: input.index,
        rendererId: `${input.pageId}.${input.slot.id}`,
        rendererKind: "tab",
        rendererLocalId: `${input.pageId}.${input.slot.id}`,
        operation: "query",
        handler: input.slot.tab.query,
      })
    : undefined;
  const tab =
    input.slot.tab && queryHandlerId ? { refreshEvents: input.slot.tab.refreshEvents, queryHandlerId } : undefined;
  return {
    ...slot,
    ...(tab ? { tab } : {}),
    ...(input.slot.view ? { view: normalizeContributionRef(input.ext, input.slot.view) } : {}),
    ...(input.slot.binding ? { binding: normalizeBinding(input.ext, input.slot.binding) } : {}),
  } as RuntimePageSlot;
};

const removedSlotCardinality = (slot: unknown) => {
  if (!isRecord(slot) || slot.cardinality === undefined) return undefined;
  return { field: "cardinality", replacement: 'declare "cardinality" on the binding instead' };
};

export const registerPages = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "page",
    contributions: contributionArray<PageContribution>(source.definition.pages),
  });

  for (const contribution of contributions) {
    const invalidField = invalidPageField(contribution);
    if (invalidField) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_page",
          message: `Page "${contribution.id}" has an invalid ${invalidField} field`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: contribution.id, fieldPath: `pages.${contribution.id}.${invalidField}` },
        }),
      );
      continue;
    }
    if (!Array.isArray(contribution.slots)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_page",
          message: `Page "${contribution.id}" must declare a slots array`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: contribution.id, fieldPath: `pages.${contribution.id}.slots` },
        }),
      );
      continue;
    }
    const validSlots = contribution.slots.filter((slot, slotIndex): slot is PageSlot => {
      const removed = removedPlacementField(slot) ?? removedSlotCardinality(slot);
      if (removed) {
        runtime.diagnostics.push(
          createDiagnostic({
            code: "invalid_page_slot",
            message: `Page "${contribution.id}" slot at index ${slotIndex} uses removed field "${removed.field}"; ${removed.replacement}`,
            extensionId: ext.id,
            sourcePath: source.sourcePath,
            metadata: {
              contributionId: contribution.id,
              fieldPath: `pages.${contribution.id}.slots.${slotIndex}.${removed.field}`,
            },
          }),
        );
        return false;
      }
      if (isPageSlot(slot)) return true;
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_page_slot",
          message: `Page "${contribution.id}" has an invalid slot at index ${slotIndex}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: contribution.id, fieldPath: `pages.${contribution.id}.slots.${slotIndex}` },
        }),
      );
      return false;
    });
    const base = contributionRecordBase(ext, source, "page", contribution.id);
    const ref = normalizeContributionRef(ext, contribution.ref);
    const slots = validSlots.map((slot) => normalizeSlot({ ext, source, runtime, index, pageId: base.id, slot }));
    const panels = Object.fromEntries(
      slots
        .filter((slot) => slot.role === "auxiliary")
        .map((slot) => [slot.id, { kind: "page-slot" as const, page: ref, id: slot.id }]),
    );
    runtime.pages.push({
      ...base,
      contribution: {
        ...contribution,
        ref,
        mode: normalizeContributionRef(ext, contribution.mode),
        ...(contribution.parent ? { parent: normalizeContributionRef(ext, contribution.parent) } : {}),
        slots,
        panels,
      },
    });
  }
};
