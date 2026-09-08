import { resourceKey } from "@pstdio/sdk/extensions";
import type { OpenWidgetInput, RegisteredWidgetContribution, WorkbenchWidgetPlacement } from "./layout-types";

export const buildUpdatedPlacement = (
  placement: WorkbenchWidgetPlacement,
  widget: RegisteredWidgetContribution,
  update: OpenWidgetInput,
): WorkbenchWidgetPlacement => {
  const next: WorkbenchWidgetPlacement = { ...placement };
  if (update.viewId !== undefined) next.viewId = update.viewId ?? undefined;
  if (update.resource === null) {
    next.resource = undefined;
    next.resourceKey = undefined;
    next.title = update.title ?? widget.title;
  } else if (update.resource) {
    next.resource = update.resource;
    next.resourceKey = resourceKey(update.resource);
    next.title = update.title ?? update.resource.label ?? widget.title;
  } else if (update.title !== undefined) {
    next.title = update.title;
  }
  if (update.pinned !== undefined) next.pinned = update.pinned;
  if (update.closable !== undefined) next.closable = update.closable;
  if (update.mountStrategy !== undefined) next.mountStrategy = update.mountStrategy;
  if (update.hiddenByDefault !== undefined) next.hiddenByDefault = update.hiddenByDefault;
  if (update.tabRetention !== undefined) next.tabRetention = update.tabRetention;
  if (update.tab !== undefined) next.tab = update.tab;
  if (update.ownerId !== undefined) next.ownerId = update.ownerId;
  if (update.source !== undefined) next.source = update.source;
  if (update.role !== undefined) next.role = update.role;
  return next;
};
export const createPlacement = (
  widgetId: string,
  widget: RegisteredWidgetContribution,
  spec: OpenWidgetInput,
): WorkbenchWidgetPlacement => ({
  widgetId,
  contributionId: widget.id,
  viewId: spec.viewId ?? undefined,
  ownerId: spec.ownerId ?? widget.ownerId,
  source: spec.source ?? widget.source,
  resource: spec.resource ?? undefined,
  resourceKey: resourceKey(spec.resource ?? undefined),
  title: spec.title ?? spec.resource?.label ?? widget.title,
  pinned: spec.pinned,
  // Tabbed (non-singleton) widgets are closable unless they opt out; singleton
  // panels stay non-closable by default.
  closable: spec.closable ?? widget.closable ?? !widget.singleton,
  mountStrategy: spec.mountStrategy ?? widget.mountStrategy,
  hiddenByDefault: spec.hiddenByDefault ?? widget.hiddenByDefault,
  tabRetention: spec.tabRetention,
  tab: spec.tab ?? widget.tab,
  role: spec.role ?? "content",
});
