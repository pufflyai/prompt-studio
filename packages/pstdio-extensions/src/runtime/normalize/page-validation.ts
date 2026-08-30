import type { ContributionRef, PageSlot } from "@pstdio/sdk/extensions";
import { isValidLocalContributionId, workbenchModeDefinitions, workbenchPageDefinitions } from "@pstdio/sdk/extensions";
import type { RuntimePageRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { Accumulator } from "./accumulator";

export interface PageDiagnosticInput {
  code: string;
  fieldPath: string;
  message: string;
  record: RuntimePageRecord | { id: string; extensionId: string; sourcePath: string };
  failedReference?: string;
}

export const addPageDiagnostic = (runtime: Accumulator, input: PageDiagnosticInput) => {
  runtime.diagnostics.push(
    createDiagnostic({
      code: input.code,
      message: input.message,
      extensionId: input.record.extensionId,
      sourcePath: input.record.sourcePath,
      metadata: {
        contributionId: input.record.id,
        fieldPath: input.fieldPath,
        ...(input.failedReference ? { failedReference: input.failedReference } : {}),
      },
    }),
  );
};

export const normalizedRefId = <Kind extends string>(
  ref: { extensionId?: string; kind: Kind; id: string },
  ownerExtensionId: string,
) => `${ref.extensionId ?? ownerExtensionId}.${ref.kind}.${ref.id}`;

const ownRefMissing = (
  runtime: Accumulator,
  record: RuntimePageRecord,
  ref: ContributionRef<"view" | "resource-kind">,
  fieldPath: string,
) => {
  if (ref.extensionId !== record.extensionId) return;
  const found =
    ref.kind === "view"
      ? runtime.views.some((candidate) => candidate.id === normalizedRefId(ref, record.extensionId))
      : runtime.resourceKinds.some(
          (candidate) => candidate.extensionId === record.extensionId && candidate.localId === ref.id,
        );
  if (found) return;
  addPageDiagnostic(runtime, {
    code: ref.kind === "view" ? "extension_view_missing" : "extension_resource_kind_missing",
    fieldPath,
    failedReference: ref.id,
    message: `Unknown ${ref.kind} "${ref.id}"`,
    record,
  });
};

const validateSlotContent = (runtime: Accumulator, record: RuntimePageRecord, slot: PageSlot, index: number) => {
  const fieldPath = `pages.${record.localId}.slots.${index}`;
  const hasView = Boolean(slot.view);
  const hasBinding = Boolean(slot.binding);
  if (slot.role === "primary" && !hasView && !hasBinding) {
    addPageDiagnostic(runtime, {
      code: "extension_page_slot_invalid",
      fieldPath,
      message: `Primary slot "${slot.id}" must define a view, a binding, or both`,
      record,
    });
  }
  if (slot.role === "auxiliary" && hasView === hasBinding) {
    addPageDiagnostic(runtime, {
      code: "extension_page_slot_invalid",
      fieldPath,
      message: `Auxiliary slot "${slot.id}" must define exactly one view or binding`,
      record,
    });
  }
  if (slot.view) ownRefMissing(runtime, record, slot.view, `${fieldPath}.view`);
  if (slot.binding) {
    ownRefMissing(runtime, record, slot.binding.kind, `${fieldPath}.binding.kind`);
    ownRefMissing(runtime, record, slot.binding.view, `${fieldPath}.binding.view`);
  }
  if (slot.defaultResource && !slot.binding) {
    addPageDiagnostic(runtime, {
      code: "extension_page_slot_invalid",
      fieldPath: `${fieldPath}.defaultResource`,
      message: `Slot "${slot.id}" has a default resource but no binding`,
      record,
    });
  }
  if (slot.defaultResource && slot.binding && slot.defaultResource.type !== slot.binding.kind.id) {
    addPageDiagnostic(runtime, {
      code: "extension_page_slot_invalid",
      fieldPath: `${fieldPath}.defaultResource`,
      message: `Default resource kind "${slot.defaultResource.type}" does not match "${slot.binding.kind.id}"`,
      record,
    });
  }
  if (slot.role === "auxiliary" && slot.defaultOpen && slot.binding && !slot.defaultResource) {
    addPageDiagnostic(runtime, {
      code: "extension_page_slot_invalid",
      fieldPath: `${fieldPath}.defaultOpen`,
      message: `Bound auxiliary slot "${slot.id}" needs a default resource before it can open by default`,
      record,
    });
  }
};

const hostModeRegions = new Map(
  Object.values(workbenchModeDefinitions).map((definition) => [
    definition.ref.id,
    definition.regions as readonly string[],
  ]),
);

const validateModeAndRegions = (runtime: Accumulator, record: RuntimePageRecord) => {
  const mode = record.contribution.mode;
  const modeOwner = mode.extensionId ?? record.extensionId;
  const regions =
    modeOwner === "pstdio"
      ? hostModeRegions.get(mode.id)
      : runtime.modes.find((candidate) => candidate.id === normalizedRefId(mode, record.extensionId))?.contribution
          .regions;
  if (!regions) {
    addPageDiagnostic(runtime, {
      code: "extension_page_mode_invalid",
      fieldPath: `pages.${record.localId}.mode`,
      failedReference: mode.id,
      message: `Page "${record.localId}" names an unknown mode or a mode without declared regions`,
      record,
    });
    return;
  }
  for (const [index, slot] of record.contribution.slots.entries()) {
    if (regions.includes(slot.region)) continue;
    addPageDiagnostic(runtime, {
      code: "extension_page_region_invalid",
      fieldPath: `pages.${record.localId}.slots.${index}.region`,
      failedReference: slot.region,
      message: `Mode "${mode.id}" does not expose region "${slot.region}"`,
      record,
    });
  }
};

const validatePageStructure = (runtime: Accumulator, record: RuntimePageRecord) => {
  const primary = record.contribution.slots.filter((slot) => slot.role === "primary");
  if (primary.length !== 1 || primary[0]?.region !== "main") {
    addPageDiagnostic(runtime, {
      code: "extension_page_primary_invalid",
      fieldPath: `pages.${record.localId}.slots`,
      message: `Page "${record.localId}" must declare exactly one primary slot in main`,
      record,
    });
  }
  if (primary[0]?.view && !primary[0].binding && primary[0].closable === true) {
    addPageDiagnostic(runtime, {
      code: "extension_page_primary_invalid",
      fieldPath: `pages.${record.localId}.slots.${record.contribution.slots.indexOf(primary[0])}.closable`,
      message: `Static primary slot "${primary[0].id}" cannot be closable`,
      record,
    });
  }
  if (primary[0]?.binding && !primary[0].view && primary[0].closable === true && !record.contribution.parent) {
    addPageDiagnostic(runtime, {
      code: "extension_page_primary_invalid",
      fieldPath: `pages.${record.localId}.parent`,
      message: `Closable bound-only page "${record.localId}" must declare a parent`,
      record,
    });
  }

  const seen = new Set<string>();
  for (const [index, slot] of record.contribution.slots.entries()) {
    if (!isValidLocalContributionId(slot.id)) {
      addPageDiagnostic(runtime, {
        code: "extension_page_slot_id_invalid",
        fieldPath: `pages.${record.localId}.slots.${index}.id`,
        failedReference: slot.id,
        message: `Slot id "${slot.id}" must use the local contribution id grammar`,
        record,
      });
    }
    if (seen.has(slot.id)) {
      addPageDiagnostic(runtime, {
        code: "extension_page_slot_duplicate",
        fieldPath: `pages.${record.localId}.slots.${index}.id`,
        failedReference: slot.id,
        message: `Slot "${slot.id}" is declared more than once`,
        record,
      });
    }
    seen.add(slot.id);
    validateSlotContent(runtime, record, slot, index);
  }
  validateModeAndRegions(runtime, record);
};

const reservedPaths = new Set<string>(
  Object.values(workbenchPageDefinitions)
    .map((definition) => definition.path)
    .filter(Boolean),
);
const reservedPageIds = new Set<string>(Object.values(workbenchPageDefinitions).map((definition) => definition.ref.id));
const hostPageIds = reservedPageIds;

const validatePaths = (runtime: Accumulator) => {
  const paths = new Map<string, RuntimePageRecord>();
  for (const record of runtime.pages) {
    const { path } = record.contribution;
    const fieldPath = `pages.${record.localId}.path`;
    if (reservedPageIds.has(record.localId)) {
      addPageDiagnostic(runtime, {
        code: "extension_page_id_reserved",
        fieldPath: `pages.${record.localId}.id`,
        failedReference: record.localId,
        message: `Page id "${record.localId}" is reserved by the host`,
        record,
      });
    }
    if (!path || !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(path)) {
      addPageDiagnostic(runtime, {
        code: "extension_page_path_invalid",
        fieldPath,
        failedReference: path,
        message: `Page path "${path}" must contain lowercase kebab-case segments`,
        record,
      });
      continue;
    }
    if (reservedPaths.has(path)) {
      addPageDiagnostic(runtime, {
        code: "extension_page_path_invalid",
        fieldPath,
        failedReference: path,
        message: `Page path "${path}" is reserved by the host`,
        record,
      });
      continue;
    }
    const key = `${record.extensionId}:${path}`;
    const existing = paths.get(key);
    if (existing) {
      addPageDiagnostic(runtime, {
        code: "extension_page_path_invalid",
        fieldPath,
        failedReference: path,
        message: `Page path "${path}" is already used by "${existing.localId}"`,
        record,
      });
      continue;
    }
    paths.set(key, record);
  }
};

const validateParentCycles = (runtime: Accumulator) => {
  const pages = new Map(runtime.pages.map((page) => [page.id, page]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const reported = new Set<string>();
  const visit = (page: RuntimePageRecord) => {
    if (visited.has(page.id)) return;
    visiting.add(page.id);
    const parent = page.contribution.parent;
    const parentId = parent ? normalizedRefId(parent, page.extensionId) : undefined;
    const parentPage = parentId ? pages.get(parentId) : undefined;
    const unknownHostParent = parent?.extensionId === "pstdio" && !hostPageIds.has(parent.id);
    if (unknownHostParent || (parent && parent.extensionId === page.extensionId && !parentPage)) {
      addPageDiagnostic(runtime, {
        code: "extension_page_missing",
        fieldPath: `pages.${page.localId}.parent`,
        failedReference: parent.id,
        message: `Unknown parent page "${parent.id}"`,
        record: page,
      });
    } else if (parentPage && visiting.has(parentPage.id) && !reported.has(parentPage.id)) {
      reported.add(parentPage.id);
      addPageDiagnostic(runtime, {
        code: "extension_page_parent_cycle",
        fieldPath: `pages.${page.localId}.parent`,
        failedReference: parentPage.localId,
        message: `Page parent cycle reaches "${parentPage.localId}"`,
        record: page,
      });
    } else if (parentPage) {
      visit(parentPage);
    }
    visiting.delete(page.id);
    visited.add(page.id);
  };
  for (const page of runtime.pages) visit(page);
};

export const validatePageDefinitions = (runtime: Accumulator) => {
  for (const record of runtime.pages) validatePageStructure(runtime, record);
  validatePaths(runtime);
  validateParentCycles(runtime);
};
