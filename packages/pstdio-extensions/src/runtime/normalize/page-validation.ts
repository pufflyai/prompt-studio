import type { ContributionRef } from "@pstdio/sdk/extensions";
import { isValidLocalContributionId, workbenchModeDefinitions, workbenchPageDefinitions } from "@pstdio/sdk/extensions";
import type { RuntimePageRecord, RuntimePageSlot } from "../../types/runtime";
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

const validateSlotContent = (runtime: Accumulator, record: RuntimePageRecord, slot: RuntimePageSlot, index: number) => {
  const fieldPath = `pages.${record.localId}.slots.${index}.item`;
  const item = slot.item;
  if (item.kind === "view") ownRefMissing(runtime, record, item.view, `${fieldPath}.view`);
  else {
    item.binding.kinds.forEach((kind, kindIndex) => {
      ownRefMissing(runtime, record, kind, `${fieldPath}.binding.kinds.${kindIndex}`);
    });
    ownRefMissing(runtime, record, item.binding.view, `${fieldPath}.binding.view`);
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
  const page = record.contribution;
  const main = page.main;
  ownRefMissing(
    runtime,
    record,
    main.kind === "view" ? main.view : main.empty,
    `pages.${record.localId}.main.${main.kind === "view" ? "view" : "empty"}`,
  );
  page.resource?.kinds.forEach((kind, index) => {
    ownRefMissing(runtime, record, kind, `pages.${record.localId}.resource.kinds.${index}`);
  });
  if (main.kind === "view" && main.cardinality === "many" && !page.resource) {
    addPageDiagnostic(runtime, {
      code: "extension_page_main_invalid",
      fieldPath: `pages.${record.localId}.resource`,
      message: "A Main view with many instances requires a routed resource constraint",
      record,
    });
  }
  if (main.kind === "view" && page.resource && !page.parent) {
    addPageDiagnostic(runtime, {
      code: "extension_page_main_invalid",
      fieldPath: `pages.${record.localId}.parent`,
      message: "A resource view page requires a parent to return to when its last tab closes",
      record,
    });
  }
  for (const [index, slot] of page.slots.entries()) {
    if (slot.openOn !== "page-resource") continue;
    if (
      slot.item.kind === "binding" &&
      slot.item.binding.kinds.some((kind) =>
        page.resource?.kinds.some((routed) => routed.id === kind.id && routed.extensionId === kind.extensionId),
      )
    )
      continue;
    addPageDiagnostic(runtime, {
      code: "extension_page_slot_invalid",
      fieldPath: `pages.${record.localId}.slots.${index}.openOn`,
      message: "A panel following the page resource must accept its resource kind",
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
