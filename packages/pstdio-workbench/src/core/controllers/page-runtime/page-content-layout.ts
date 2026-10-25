import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import {
  indexCurrentOwnedPlacements,
  type ReconcileOwnedWidgetLayoutInput,
  renderDesiredPlacements,
} from "../../registries/layout/owned-placement-layout";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { isPageContent, isSingleViewPage } from "../../registries/pages/page-main";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";

export type MigratePagePanelView = (
  page: WorkbenchPageContribution,
  widget: WorkbenchWidgetPlacement,
  layout: WorkbenchLayout,
) => WorkbenchWidgetPlacement | undefined;
const canonicalKey = (widget: WorkbenchWidgetPlacement) =>
  widget.placementIdentity ? placementIdentityKey(widget.placementIdentity) : `widget:${widget.widgetId}`;

const mapContentTabs = (
  layout: WorkbenchLayout,
  pages: readonly WorkbenchPageContribution[],
  pageScope: boolean,
  migrate?: MigratePagePanelView,
) =>
  Object.values(layout.regions).flatMap((region) =>
    region.widgets.map((widget) => {
      const identity = widget.placementIdentity;
      const page = identity?.kind === "page" ? pages.find((page) => page.id === identity.pageId) : undefined;
      let next: WorkbenchWidgetPlacement | undefined = widget;
      if (region.id === "main" && (pageScope || isPageContent(page, identity))) next = undefined;
      else if (page && migrate)
        next = migrate(page, widget, layout) ?? (isPageContent(page, identity) ? undefined : widget);
      const rank =
        Number(next === widget) * 4 +
        Number(widget.widgetId === layout.activeWidgetId) * 2 +
        Number(widget.widgetId === region.activeWidgetId);
      return { widget, next, rank };
    }),
  );

/** Retire old Main trays and give moved page tabs their independent panel owner. */
export const prunePageContentLayout = (
  scope: string | undefined,
  layout: WorkbenchLayout,
  pages: readonly WorkbenchPageContribution[],
  migrate?: MigratePagePanelView,
) => {
  const prefix = ["workbench-main:", "workbench-collection-main:"].find((prefix) => scope?.startsWith(prefix));
  const ownerId = prefix ? JSON.parse(scope!.slice(prefix.length))[2] : undefined;
  const pageScope = isSingleViewPage(pages.find((page) => page.id === ownerId));
  const mapped = mapContentTabs(layout, pages, pageScope, migrate);
  const chosen = new Map<string, (typeof mapped)[number]>();
  for (const candidate of mapped) {
    if (!candidate.next) continue;
    const key = canonicalKey(candidate.next);
    const previous = chosen.get(key);
    if (!previous || candidate.rank > previous.rank) chosen.set(key, candidate);
  }
  const replacements = new Map(
    mapped
      .filter((entry) => entry.next !== entry.widget)
      .map(
        ({ widget, next }) =>
          [widget.widgetId, next ? chosen.get(canonicalKey(next))?.next?.widgetId : undefined] as const,
      ),
  );
  if (!replacements.size) return layout;
  const kept = new Map(
    mapped.flatMap(({ widget, next }) =>
      next && chosen.get(canonicalKey(next))?.widget === widget ? [[widget, next] as const] : [],
    ),
  );
  const replace = (id: string | undefined) => (id && replacements.has(id) ? replacements.get(id) : id);
  const regions = { ...layout.regions };
  for (const region of Object.values(layout.regions)) {
    const widgets = region.widgets.flatMap((widget) => (kept.get(widget) ? [kept.get(widget)!] : []));
    const ids = new Set(widgets.map((widget) => widget.widgetId));
    const active = replace(region.activeWidgetId);
    regions[region.id] = {
      ...region,
      widgets,
      activeWidgetId: active && ids.has(active) ? active : widgets[0]?.widgetId,
      savedWidgetOrder: region.savedWidgetOrder
        ? [
            ...new Set(
              region.savedWidgetOrder.flatMap((id) => {
                const next = replace(id);
                return next && ids.has(next) ? [next] : [];
              }),
            ),
          ]
        : undefined,
    };
  }
  const activeWidgetId = replace(layout.activeWidgetId);
  const active = [...kept.values()].find((widget) => widget.widgetId === activeWidgetId);
  return {
    ...layout,
    regions,
    activeWidgetId,
    activeLocationWidgetId: replacements.has(layout.activeLocationWidgetId ?? "")
      ? undefined
      : layout.activeLocationWidgetId,
    activeResourceKey: resourceKey(active?.resource),
  };
};

export const preparePageContentTrays = (input: ReconcileOwnedWidgetLayoutInput) => {
  // The rendered destination owns a tab's tray, even when its declaration defaults to Main.
  const auxiliary = new Set(
    renderDesiredPlacements(input, indexCurrentOwnedPlacements(input.layout))
      .filter((placement) => placement.region !== "main")
      .map((placement) => placementIdentityKey(placement.identity)),
  );
  return {
    ...input,
    layout: {
      ...input.layout,
      regions: {
        ...input.layout.regions,
        main: { ...input.layout.regions.main, widgets: [], activeWidgetId: undefined },
      },
    },
    placements: input.placements.filter((placement) => auxiliary.has(placementIdentityKey(placement.identity))),
    activate: input.activate?.filter((identity) => auxiliary.has(placementIdentityKey(identity))),
  };
};
