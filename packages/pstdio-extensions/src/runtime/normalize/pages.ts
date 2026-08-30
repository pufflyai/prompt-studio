import type { NavigationTarget, PageContribution, PageSlot } from "@pstdio/sdk/extensions";
import { workbenchPageDefinitions } from "@pstdio/sdk/extensions";
import type { RuntimePageRecord } from "../../types/runtime-ui";
import { createDiagnostic } from "../diagnostics";
import type { Accumulator } from "./accumulator";
import { resolveResourceKindReference } from "./references";

// The regions whose panels hold a tab strip with a preview tab. `sidenav` never
// previews, so `many` slots are allowed only here.
const panelRegions = new Set(["main", "side", "secondary"]);

const reservedHostSegments = new Set<string>(
  Object.values(workbenchPageDefinitions)
    .map((definition) => definition.path as string)
    .filter((path) => path.length > 0),
);

const hostPagesById = new Map(
  Object.values(workbenchPageDefinitions).map((definition) => [definition.ref.id, definition]),
);

type PageDiagnosticSite = { extensionId: string; sourcePath: string; id: string };

const pageDiagnostic = (
  runtime: Accumulator,
  record: PageDiagnosticSite,
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

const isBoundSlot = (slot: PageSlot) => !slot.view;

// A kind ref resolves to the bare declared kind id for host kinds and installed
// extension kinds; a namespaced id that stays namespaced belongs to an extension this
// check cannot see, so it is shape-checked only.
const kindKey = (
  ref: { extensionId?: string; id: string },
  ownerExtensionId: string,
  references: ReadonlyMap<string, string>,
) => {
  const extensionId = ref.extensionId ?? ownerExtensionId;
  if (extensionId === "pstdio") return ref.id;
  return resolveResourceKindReference(`${extensionId}.${ref.id}`, references);
};

const missingOwnViewId = (runtime: Accumulator, record: RuntimePageRecord, view: PageSlot["view"]) => {
  if (!view || view.extensionId !== record.extensionId) return undefined;
  const viewId = `${view.extensionId}.view.${view.id}`;
  return runtime.views.some((candidate) => candidate.id === viewId) ? undefined : viewId;
};

const slotShapeError = (slot: PageSlot) => {
  if (slot.view && (slot.cardinality || slot.follows)) {
    return `Slot "${slot.id}" is static (it names a view); cardinality and follows apply to bound slots only`;
  }
  if (!slot.view && (slot.defaultOpen !== undefined || slot.scope !== undefined)) {
    return `Slot "${slot.id}" is bound; defaultOpen and scope apply to static slots only`;
  }
  if (slot.cardinality === "many" && !panelRegions.has(slot.region)) {
    return `Slot "${slot.id}" declares cardinality "many" in region "${slot.region}"; many-cardinality slots need a panel region (main, side, or secondary)`;
  }
  return undefined;
};

const validateSlots = (runtime: Accumulator, record: RuntimePageRecord) => {
  const slotsById = new Map<string, PageSlot>();
  for (const slot of record.contribution.slots) {
    if (slotsById.has(slot.id)) {
      pageDiagnostic(runtime, record, "extension_page_slot_duplicate", slot.id, `Slot "${slot.id}" is declared twice`);
      continue;
    }
    slotsById.set(slot.id, slot);
    const shapeError = slotShapeError(slot);
    if (shapeError) pageDiagnostic(runtime, record, "extension_page_slot_invalid", slot.id, shapeError);
    const missingView = missingOwnViewId(runtime, record, slot.view);
    if (missingView) {
      pageDiagnostic(runtime, record, "extension_view_missing", missingView, `Unknown view "${missingView}"`);
    }
  }
  return slotsById;
};

const validateBindings = (
  runtime: Accumulator,
  record: RuntimePageRecord,
  slotsById: ReadonlyMap<string, PageSlot>,
  references: ReadonlyMap<string, string>,
) => {
  const boundKindsBySlot = new Map<string, Set<string>>();
  const seenBindings = new Set<string>();
  for (const binding of record.contribution.bindings ?? []) {
    const slot = slotsById.get(binding.slot);
    if (!slot || !isBoundSlot(slot)) {
      pageDiagnostic(
        runtime,
        record,
        "extension_page_binding_invalid",
        binding.slot,
        `Binding targets "${binding.slot}", which is not a bound slot on this page`,
      );
      continue;
    }
    const kind = kindKey(binding.resourceKind, record.extensionId, references);
    const bindingKey = `${kind}\0${binding.slot}`;
    if (seenBindings.has(bindingKey)) {
      pageDiagnostic(
        runtime,
        record,
        "extension_page_binding_invalid",
        bindingKey,
        `Kind "${kind}" is bound to slot "${binding.slot}" more than once`,
      );
      continue;
    }
    seenBindings.add(bindingKey);
    boundKindsBySlot.set(binding.slot, new Set([...(boundKindsBySlot.get(binding.slot) ?? []), kind]));
    const missingView = missingOwnViewId(runtime, record, binding.view);
    if (missingView) {
      pageDiagnostic(runtime, record, "extension_view_missing", missingView, `Unknown view "${missingView}"`);
    }
  }
  return boundKindsBySlot;
};

const validateFollows = (
  runtime: Accumulator,
  record: RuntimePageRecord,
  slotsById: ReadonlyMap<string, PageSlot>,
  boundKindsBySlot: ReadonlyMap<string, Set<string>>,
) => {
  for (const slot of record.contribution.slots) {
    if (!slot.follows) continue;
    const target = slotsById.get(slot.follows);
    if (!target || target.cardinality !== "many") {
      pageDiagnostic(
        runtime,
        record,
        "extension_page_follows_invalid",
        slot.follows,
        `Slot "${slot.id}" follows "${slot.follows}", which is not a many-cardinality slot on this page`,
      );
      continue;
    }
    const followerKinds = boundKindsBySlot.get(slot.id) ?? new Set<string>();
    const targetKinds = boundKindsBySlot.get(slot.follows) ?? new Set<string>();
    if (![...followerKinds].some((kind) => targetKinds.has(kind))) {
      pageDiagnostic(
        runtime,
        record,
        "extension_page_follows_invalid",
        slot.follows,
        `Slot "${slot.id}" follows "${slot.follows}" but binds none of its resource kinds`,
      );
    }
  }
};

const warnInertLocationScopes = (runtime: Accumulator, record: RuntimePageRecord) => {
  if ((record.contribution.bindings ?? []).length > 0) return;
  for (const slot of record.contribution.slots) {
    if (slot.scope !== "location") continue;
    runtime.diagnostics.push(
      createDiagnostic({
        code: "extension_page_scope_inert",
        severity: "warning",
        message: `Slot "${slot.id}" declares scope "location" but the page has no bindings, so its location never changes`,
        extensionId: record.extensionId,
        sourcePath: record.sourcePath,
        metadata: { contributionId: record.id },
      }),
    );
  }
};

const validatePageStructure = (
  runtime: Accumulator,
  record: RuntimePageRecord,
  references: ReadonlyMap<string, string>,
) => {
  const slotsById = validateSlots(runtime, record);
  const boundKindsBySlot = validateBindings(runtime, record, slotsById, references);
  validateFollows(runtime, record, slotsById, boundKindsBySlot);
  warnInertLocationScopes(runtime, record);
};

const validatePagePaths = (runtime: Accumulator) => {
  const pathsByExtension = new Map<string, Map<string, RuntimePageRecord>>();
  for (const record of runtime.pages) {
    const path = record.contribution.path;
    if (path === undefined) continue;
    if (path.length === 0 || !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(path)) {
      pageDiagnostic(
        runtime,
        record,
        "extension_page_path_invalid",
        path,
        `Page path "${path}" must be lowercase kebab-case segments separated by "/"`,
      );
      continue;
    }
    if (reservedHostSegments.has(path)) {
      pageDiagnostic(
        runtime,
        record,
        "extension_page_path_invalid",
        path,
        `Page path "${path}" is a reserved host segment`,
      );
      continue;
    }
    const paths = pathsByExtension.get(record.extensionId) ?? new Map<string, RuntimePageRecord>();
    const existing = paths.get(path);
    if (existing) {
      pageDiagnostic(
        runtime,
        record,
        "extension_page_path_invalid",
        path,
        `Page path "${path}" is already used by "${existing.localId}"`,
      );
      continue;
    }
    paths.set(path, record);
    pathsByExtension.set(record.extensionId, paths);
  }
};

const pageBoundKinds = (page: PageContribution, ownerExtensionId: string, references: ReadonlyMap<string, string>) =>
  new Set((page.bindings ?? []).map((binding) => kindKey(binding.resourceKind, ownerExtensionId, references)));

const validatePageTarget = (
  runtime: Accumulator,
  record: PageDiagnosticSite & { extensionId: string },
  target: Extract<NavigationTarget, { kind: "page" }>,
  references: ReadonlyMap<string, string>,
) => {
  const pageOwner = target.page.extensionId ?? record.extensionId;

  if (pageOwner === "pstdio") {
    const hostPage = hostPagesById.get(target.page.id);
    if (!hostPage) {
      pageDiagnostic(
        runtime,
        record,
        "extension_page_missing",
        target.page.id,
        `Unknown host page "${target.page.id}"; the host publishes ${[...hostPagesById.keys()].join(", ")}`,
      );
      return;
    }
    if (target.resource && !(hostPage.binds as readonly string[]).includes(target.resource.type)) {
      pageDiagnostic(
        runtime,
        record,
        "extension_page_target_invalid",
        target.resource.type,
        `Host page "${target.page.id}" does not bind resource kind "${target.resource.type}"`,
      );
    }
    return;
  }

  // Refs into other extensions are shape-checked only: check runs against one manifest.
  if (pageOwner !== record.extensionId) return;

  const pageId = `${pageOwner}.page.${target.page.id}`;
  const page = runtime.pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    pageDiagnostic(runtime, record, "extension_page_missing", pageId, `Unknown page "${pageId}"`);
    return;
  }
  if (target.slot && !page.contribution.slots.some((slot) => slot.id === target.slot)) {
    pageDiagnostic(
      runtime,
      record,
      "extension_page_target_invalid",
      target.slot,
      `Page "${page.localId}" has no slot "${target.slot}"`,
    );
  }
  if (target.resource) {
    const bound = pageBoundKinds(page.contribution, page.extensionId, references);
    if (!bound.has(target.resource.type)) {
      pageDiagnostic(
        runtime,
        record,
        "extension_page_target_invalid",
        target.resource.type,
        `Page "${page.localId}" does not bind resource kind "${target.resource.type}"`,
      );
    }
  }
};

const validateNavigationPageTargets = (runtime: Accumulator, references: ReadonlyMap<string, string>) => {
  for (const record of runtime.navigationItems) {
    const visit = (target: NavigationTarget) => {
      if (target.kind === "compound") {
        for (const item of target.targets) visit(item);
        return;
      }
      if (target.kind === "page") validatePageTarget(runtime, record, target, references);
    };
    visit(record.contribution.action);
  }

  for (const record of runtime.commandPaletteResources) {
    const page = record.contribution.page;
    if (!page) continue;
    validatePageTarget(runtime, record, { kind: "page", page }, references);
  }
};

export const validatePages = (runtime: Accumulator, references: ReadonlyMap<string, string>) => {
  for (const record of runtime.pages) {
    validatePageStructure(runtime, record, references);
  }
  validatePagePaths(runtime);
  validateNavigationPageTargets(runtime, references);
};
