import type { PageLocation, ViewLocation } from "@pstdio/sdk/extensions";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { canonicalResourceRef } from "../../shared/contributions/resource-identity";

const pageContext = (context: ViewLocation["pageContext"]): ViewLocation["pageContext"] => {
  if (!context) return context;
  const next = {
    ...context,
    page: context.page.extensionId
      ? { ...context.page, extensionId: canonicalExtensionId(context.page.extensionId) }
      : context.page,
    parent: context.parent && location(context.parent),
  };
  return next.page.extensionId === context.page.extensionId && next.parent === context.parent ? context : next;
};
const location = (value: PageLocation): PageLocation => {
  const next = { ...value, ...pageContext(value), resource: value.resource && canonicalResourceRef(value.resource) };
  return next.page.extensionId === value.page.extensionId &&
    next.parent === value.parent &&
    next.resource === value.resource
    ? value
    : next;
};
const placement = (value: WorkbenchWidgetPlacement, canonicalId: (id: string) => string) => {
  const identity = value.placementIdentity;
  let placementIdentity = identity;
  if (identity?.kind === "page") placementIdentity = { ...identity, pageId: canonicalId(identity.pageId) };
  if (identity?.kind === "mode")
    placementIdentity = {
      ...identity,
      modeId: canonicalId(identity.modeId),
      placementId: canonicalId(identity.placementId),
    };
  if (identity?.kind === "shell") placementIdentity = { ...identity, placementId: canonicalId(identity.placementId) };
  const next = {
    ...value,
    contributionId: canonicalId(value.contributionId),
    viewId: value.viewId && canonicalId(value.viewId),
    ownerId: value.ownerId && canonicalId(value.ownerId),
    resource: value.resource && canonicalResourceRef(value.resource),
    pageContext: pageContext(value.pageContext),
    placementIdentity,
  };
  const sameIdentity =
    !identity ||
    Object.entries(identity).every(
      ([key, field]) => placementIdentity?.[key as keyof typeof placementIdentity] === field,
    );
  return sameIdentity &&
    next.contributionId === value.contributionId &&
    next.viewId === value.viewId &&
    next.ownerId === value.ownerId &&
    next.resource === value.resource &&
    next.pageContext === value.pageContext
    ? value
    : next;
};

/** Decode typed persisted references while keeping widget, instance and resource IDs opaque. */
export const canonicalLayout = (layout: WorkbenchLayout, canonicalId: (id: string) => string): WorkbenchLayout => {
  let changed = false;
  const regions = { ...layout.regions };
  for (const id of Object.keys(regions) as (keyof typeof regions)[]) {
    const region = regions[id];
    const widgets = region.widgets.map((widget) => placement(widget, canonicalId));
    if (widgets.some((widget, index) => widget !== region.widgets[index])) {
      regions[id] = { ...region, widgets };
      changed = true;
    }
  }
  return changed ? { ...layout, regions } : layout;
};
