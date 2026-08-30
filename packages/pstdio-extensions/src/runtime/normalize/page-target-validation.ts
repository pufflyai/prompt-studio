import {
  type NavigationTarget,
  type NavigationTargetPage,
  type NavigationTargetPanel,
  type PageSlot,
  type ResourceRef,
  workbenchPageDefinitions,
  workbenchPanelDefinitions,
} from "@pstdio/sdk/extensions";
import type { RuntimeNavigationItemRecord } from "../../types/runtime";
import type { Accumulator } from "./accumulator";
import { addPageDiagnostic, normalizedRefId } from "./page-validation";

interface Destination {
  bindingKinds: readonly string[];
  cardinality: "one" | "many";
  staticView: boolean;
}

const validateResourceInput = (
  runtime: Accumulator,
  record: RuntimeNavigationItemRecord,
  input: {
    destination: Destination;
    fieldPath: string;
    resource?: ResourceRef;
    open?: "preview" | "pin";
    targetKind: "page" | "panel";
  },
) => {
  const { destination, fieldPath, open, resource, targetKind } = input;
  const code = targetKind === "page" ? "extension_page_target_invalid" : "extension_panel_target_invalid";
  if (resource && destination.bindingKinds.length === 0) {
    addPageDiagnostic(runtime, {
      code,
      fieldPath: `${fieldPath}.resource`,
      failedReference: resource.type,
      message: `The ${targetKind} destination does not accept a resource`,
      record,
    });
  } else if (resource && !destination.bindingKinds.includes(resource.type)) {
    addPageDiagnostic(runtime, {
      code,
      fieldPath: `${fieldPath}.resource`,
      failedReference: resource.type,
      message: `Resource kind "${resource.type}" does not match ${destination.bindingKinds.join(", ")}`,
      record,
    });
  } else if (!resource && destination.bindingKinds.length > 0 && !destination.staticView) {
    addPageDiagnostic(runtime, {
      code,
      fieldPath: `${fieldPath}.resource`,
      failedReference: destination.bindingKinds[0],
      message: `The ${targetKind} destination requires a resource of kind ${destination.bindingKinds.join(", ")}`,
      record,
    });
  }
  if (open && destination.cardinality !== "many") {
    addPageDiagnostic(runtime, {
      code,
      fieldPath: `${fieldPath}.open`,
      failedReference: open,
      message: `Open intent applies only to a many-cardinality ${targetKind} destination`,
      record,
    });
  }
};

const slotDestination = (slot: PageSlot): Destination => ({
  bindingKinds: slot.binding ? [slot.binding.kind.id] : [],
  cardinality: slot.cardinality ?? "one",
  staticView: Boolean(slot.view),
});

const hostPages = new Map(Object.values(workbenchPageDefinitions).map((definition) => [definition.ref.id, definition]));

const resolvePageDestination = (
  runtime: Accumulator,
  record: RuntimeNavigationItemRecord,
  target: NavigationTargetPage,
  fieldPath: string,
) => {
  const owner = target.page.extensionId ?? record.extensionId;
  if (owner === "pstdio") {
    const definition = hostPages.get(target.page.id);
    if (!definition) {
      addPageDiagnostic(runtime, {
        code: "extension_page_missing",
        fieldPath: `${fieldPath}.page`,
        failedReference: target.page.id,
        message: `Unknown host page "${target.page.id}"`,
        record,
      });
      return undefined;
    }
    return {
      bindingKinds: definition.primary.resourceKinds,
      cardinality: definition.primary.cardinality,
      staticView: definition.primary.resourceKinds.length === 0,
    } satisfies Destination;
  }
  if (owner !== record.extensionId) return undefined;
  const page = runtime.pages.find((candidate) => candidate.id === normalizedRefId(target.page, record.extensionId));
  if (!page) {
    addPageDiagnostic(runtime, {
      code: "extension_page_missing",
      fieldPath: `${fieldPath}.page`,
      failedReference: target.page.id,
      message: `Unknown page "${target.page.id}"`,
      record,
    });
    return undefined;
  }
  const primary = page.contribution.slots.find((slot) => slot.role === "primary");
  return primary ? slotDestination(primary) : undefined;
};

const validatePageTarget = (
  runtime: Accumulator,
  record: RuntimeNavigationItemRecord,
  target: NavigationTargetPage,
  fieldPath: string,
  ancestors: Set<NavigationTargetPage>,
) => {
  if (ancestors.has(target)) {
    addPageDiagnostic(runtime, {
      code: "extension_page_target_invalid",
      fieldPath: `${fieldPath}.parent`,
      message: "Page target parent chain contains a cycle",
      record,
    });
    return;
  }
  const destination = resolvePageDestination(runtime, record, target, fieldPath);
  if (destination) {
    validateResourceInput(runtime, record, {
      destination,
      fieldPath,
      resource: target.resource,
      open: target.open,
      targetKind: "page",
    });
  }
  if (!target.parent) return;
  const next = new Set(ancestors);
  next.add(target);
  validatePageTarget(runtime, record, target.parent, `${fieldPath}.parent`, next);
};

const hostPanels = new Map(
  Object.values(workbenchPanelDefinitions).map((definition) => [definition.ref.id, definition]),
);

const resolvePlacementDestination = (
  runtime: Accumulator,
  record: RuntimeNavigationItemRecord,
  target: NavigationTargetPanel,
  fieldPath: string,
) => {
  if (target.panel.kind === "page-slot") {
    const panel = target.panel;
    const owner = panel.page.extensionId ?? record.extensionId;
    if (owner !== record.extensionId) return undefined;
    const page = runtime.pages.find((candidate) => candidate.id === normalizedRefId(panel.page, record.extensionId));
    const slot = page?.contribution.slots.find((candidate) => candidate.id === panel.id);
    if (!slot || slot.role !== "auxiliary") {
      addPageDiagnostic(runtime, {
        code: "extension_panel_target_invalid",
        fieldPath: `${fieldPath}.panel`,
        failedReference: panel.id,
        message: `Unknown auxiliary page slot "${panel.id}"`,
        record,
      });
      return undefined;
    }
    return slotDestination(slot);
  }

  const owner = target.panel.extensionId ?? record.extensionId;
  if (owner === "pstdio") {
    const definition = hostPanels.get(target.panel.id);
    if (!definition) {
      addPageDiagnostic(runtime, {
        code: "extension_panel_target_invalid",
        fieldPath: `${fieldPath}.panel`,
        failedReference: target.panel.id,
        message: `Unknown host panel "${target.panel.id}"`,
        record,
      });
      return undefined;
    }
    return {
      bindingKinds: definition.resourceKinds,
      cardinality: definition.cardinality,
      staticView: false,
    } satisfies Destination;
  }
  if (owner !== record.extensionId) return undefined;
  const placement = runtime.placements.find(
    (candidate) => candidate.id === normalizedRefId(target.panel, record.extensionId),
  );
  if (!placement) {
    addPageDiagnostic(runtime, {
      code: "extension_panel_target_invalid",
      fieldPath: `${fieldPath}.panel`,
      failedReference: target.panel.id,
      message: `Unknown mode placement "${target.panel.id}"`,
      record,
    });
    return undefined;
  }
  if (placement.contribution.item.kind === "view") {
    return { bindingKinds: [], cardinality: "one", staticView: true } satisfies Destination;
  }
  const resourceKind = placement.contribution.item.slot.resourceKind;
  const kind = runtime.resourceKinds.find(
    (candidate) => candidate.extensionId === resourceKind.extensionId && candidate.localId === resourceKind.id,
  );
  const slot = kind?.contribution.slots[placement.contribution.item.slot.id];
  return {
    bindingKinds: [resourceKind.id],
    cardinality: slot?.cardinality ?? "one",
    staticView: false,
  } satisfies Destination;
};

const validatePanelTarget = (
  runtime: Accumulator,
  record: RuntimeNavigationItemRecord,
  target: NavigationTargetPanel,
  fieldPath: string,
) => {
  const destination = resolvePlacementDestination(runtime, record, target, fieldPath);
  if (!destination) return;
  validateResourceInput(runtime, record, {
    destination,
    fieldPath,
    resource: target.resource,
    open: target.open,
    targetKind: "panel",
  });
};

const validateTarget = (
  runtime: Accumulator,
  record: RuntimeNavigationItemRecord,
  target: NavigationTarget,
  fieldPath: string,
) => {
  if (target.kind === "page") validatePageTarget(runtime, record, target, fieldPath, new Set());
  if (target.kind === "panel") validatePanelTarget(runtime, record, target, fieldPath);
  if (target.kind !== "compound") return;

  const pageIndexes = target.targets.flatMap((item, index) => (item.kind === "page" ? [index] : []));
  const invalidPageSequence =
    pageIndexes.length === 1 && (pageIndexes[0] !== 0 || target.targets.slice(1).some((item) => item.kind !== "panel"));
  if (pageIndexes.length > 1 || invalidPageSequence) {
    addPageDiagnostic(runtime, {
      code: "extension_navigation_target_invalid",
      fieldPath,
      message: "A compound target may contain one page followed by panel targets",
      record,
    });
  }
  for (const [index, item] of target.targets.entries()) {
    if (item.kind === "page") validatePageTarget(runtime, record, item, `${fieldPath}.targets.${index}`, new Set());
    if (item.kind === "panel") validatePanelTarget(runtime, record, item, `${fieldPath}.targets.${index}`);
  }
};

export const validatePageNavigationTargets = (runtime: Accumulator) => {
  for (const record of runtime.navigationItems) {
    validateTarget(runtime, record, record.contribution.action, `navigationItems.${record.localId}.action`);
  }
};
