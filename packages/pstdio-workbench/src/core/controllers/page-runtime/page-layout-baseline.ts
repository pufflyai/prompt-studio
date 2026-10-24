import type { ResourceRef } from "@pstdio/sdk/extensions";
import { defaultPageResourceCodec } from "pstdio-api-contracts";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { composeOwnedPlacements, placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { resolvePagePlacements } from "../../registries/pages/page-placement-resolver";
import type {
  WorkbenchPageContribution,
  WorkbenchPagePlacementInput,
  WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry-types";
import { pageResourceContextKey, pageResourceInstanceKey } from "../../registries/pages/page-resource-context";
import {
  emptyPageState,
  openPageResourceBindings,
  selectPrimaryTarget,
} from "../../registries/pages/page-slot-lifecycle";
import { staticPageInstanceKey } from "../../registries/pages/page-state-key";

const defaultMain = (
  page: WorkbenchPageContribution,
  resource: ResourceRef | undefined,
  resources: WorkbenchPageResourceCodec,
) => {
  const target = { pageId: page.id, resource };
  const key = (resource: ResourceRef) => pageResourceInstanceKey(page, resource, resources);
  const state = openPageResourceBindings({
    page,
    state: selectPrimaryTarget({ page, state: emptyPageState(page), target, resourceKey: key }),
    target,
    resourceKey: key,
  });
  return composeOwnedPlacements({
    shell: [],
    page: resolvePagePlacements({
      page,
      resource,
      state,
      staticInstanceKey: staticPageInstanceKey(page, resource, resources),
      sharedPlacements: [],
      resolvePagePlacement: (placement) => placement,
    }),
  }).regions.main;
};

const matchesDefault = (
  actual: WorkbenchWidgetPlacement,
  expected: WorkbenchPagePlacementInput,
  page: WorkbenchPageContribution,
) =>
  actual.placementIdentity &&
  placementIdentityKey(actual.placementIdentity) === placementIdentityKey(expected.identity) &&
  actual.viewId === expected.viewId &&
  pageResourceContextKey(page, actual.resource) === pageResourceContextKey(page, expected.resource) &&
  Boolean(actual.pinned) === (expected.open !== "preview") &&
  actual.tabRetention === (expected.open === "preview" ? "preview" : "persistent") &&
  JSON.stringify(actual.section) === JSON.stringify(expected.section);

export const isDefaultPageMain = (
  page: WorkbenchPageContribution | undefined,
  resource: ResourceRef | undefined,
  layout: WorkbenchLayout,
  resources = defaultPageResourceCodec,
) => {
  if (!page || (page.resource && !resource)) return false;
  const expected = defaultMain(page, resource, resources);
  const main = layout.regions.main;
  if (main.widgets.length !== expected.length) return false;
  if (!main.widgets.every((widget, index) => matchesDefault(widget, expected[index].value, page))) return false;
  const selected = main.widgets.find((widget) => widget.widgetId === main.activeWidgetId) ?? main.widgets[0];
  const primary = expected.find((placement) => placement.value.role === "primary") ?? expected[0];
  // Mode geometry is independent of page tray membership, ordering, pinning,
  // and selection. Header choices are checked separately by the page cache.
  return selected?.placementIdentity && primary
    ? placementIdentityKey(selected.placementIdentity) === placementIdentityKey(primary.identity)
    : !selected && !primary;
};
