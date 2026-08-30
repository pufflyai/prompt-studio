import { dockedWorkbenchRegions, type PageContribution, type PageSlot } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimePageRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { isLocalizableString } from "./localizable";
import { normalizeContributionRef } from "./references";

const isRef = (value: unknown, kind: string) =>
  isRecord(value) &&
  value.kind === kind &&
  typeof value.id === "string" &&
  (value.extensionId === undefined || typeof value.extensionId === "string");

const isOptionalBoolean = (value: unknown) => value === undefined || typeof value === "boolean";

const isPageSlotBinding = (value: unknown) =>
  value === undefined || (isRecord(value) && isRef(value.kind, "resource-kind") && isRef(value.view, "view"));

const isDefaultResource = (value: unknown) =>
  value === undefined || (isRecord(value) && typeof value.type === "string" && typeof value.id === "string");

const hasValidSlotOptions = (value: Record<string, unknown>) =>
  (value.cardinality === undefined || value.cardinality === "one" || value.cardinality === "many") &&
  isOptionalBoolean(value.closable) &&
  isOptionalBoolean(value.defaultOpen) &&
  (value.order === undefined || (typeof value.order === "number" && Number.isFinite(value.order))) &&
  isDefaultResource(value.defaultResource);

const isPageSlot = (value: unknown): value is PageSlot => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    (value.role !== "primary" && value.role !== "auxiliary") ||
    typeof value.region !== "string" ||
    !dockedWorkbenchRegions.includes(value.region as (typeof dockedWorkbenchRegions)[number])
  ) {
    return false;
  }
  if (value.view !== undefined && !isRef(value.view, "view")) return false;
  return isPageSlotBinding(value.binding) && hasValidSlotOptions(value);
};

const invalidPageField = (contribution: PageContribution) => {
  if (!isLocalizableString(contribution.title)) return "title";
  if (contribution.icon !== undefined && typeof contribution.icon !== "string") return "icon";
  if (typeof contribution.path !== "string") return "path";
  if (!isRef(contribution.mode, "mode")) return "mode";
  if (contribution.parent !== undefined && !isRef(contribution.parent, "page")) return "parent";
  return undefined;
};

const normalizeSlot = (ext: NormalizedExtension, slot: PageSlot): PageSlot => ({
  ...slot,
  ...(slot.view ? { view: normalizeContributionRef(ext, slot.view) } : {}),
  ...(slot.binding
    ? {
        binding: {
          kind: normalizeContributionRef(ext, slot.binding.kind),
          view: normalizeContributionRef(ext, slot.binding.view),
        },
      }
    : {}),
});

export const registerPages = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
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
    const validSlots = contribution.slots.filter((slot, index): slot is PageSlot => {
      if (isPageSlot(slot)) return true;
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_page_slot",
          message: `Page "${contribution.id}" has an invalid slot at index ${index}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: contribution.id, fieldPath: `pages.${contribution.id}.slots.${index}` },
        }),
      );
      return false;
    });
    const ref = normalizeContributionRef(ext, contribution.ref);
    const slots = validSlots.map((slot) => normalizeSlot(ext, slot));
    const panels = Object.fromEntries(
      slots
        .filter((slot) => slot.role === "auxiliary")
        .map((slot) => [slot.id, { kind: "page-slot" as const, page: ref, id: slot.id }]),
    );
    runtime.pages.push({
      ...contributionRecordBase(ext, source, "page", contribution.id),
      contribution: {
        ...contribution,
        ref,
        mode: normalizeContributionRef(ext, contribution.mode),
        ...(contribution.parent ? { parent: normalizeContributionRef(ext, contribution.parent) } : {}),
        slots,
        panels,
      },
    } as RuntimePageRecord);
  }
};
