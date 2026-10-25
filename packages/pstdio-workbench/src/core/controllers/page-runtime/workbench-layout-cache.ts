import { type PageLocation, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { LayoutPersistenceAdapter } from "../../registries/layout/layout-model-types";
import { restoreLayoutPresentation } from "../../registries/layout/layout-tab-presentation";
import {
  type WorkbenchLayout,
  type WorkbenchWidgetPlacement,
  workbenchRegions,
} from "../../registries/layout/layout-types";
import { getWorkbenchModePanelForRegion } from "../../registries/modes/mode-layout";
import { removeViewContextResources } from "../../registries/pages/page-location-resource-removal";
import { isSingleViewPage } from "../../registries/pages/page-main";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { createWorkbenchInput, WorkbenchPagePersistenceScopeInput } from "../../workbench-core-types";
import { migrateCollectionMain } from "./collection-main-migration";
import { createOpenPlacementInventory } from "./open-placement-inventory";
import { type MigratePagePanelView, prunePageContentLayout } from "./page-content-layout";
import { createPageHeaderCache } from "./page-header-layout";
import { assemblePageLayout } from "./page-layout-assembly";
import { isDefaultPageMain } from "./page-layout-baseline";
import { createPageMainScopes, mainScope } from "./page-main-scope";

const selectPlacements = (
  layout: WorkbenchLayout,
  include: (placement: WorkbenchWidgetPlacement, region: (typeof workbenchRegions)[number]) => boolean,
) => {
  const regions = { ...layout.regions };
  for (const id of workbenchRegions) {
    const region = layout.regions[id];
    const widgets = region.widgets.filter((widget) => include(widget, id));
    regions[id] = {
      ...region,
      widgets,
      activeWidgetId: widgets.some((widget) => widget.widgetId === region.activeWidgetId)
        ? region.activeWidgetId
        : undefined,
    };
  }
  return { ...layout, regions };
};
const modeScope = (projectId: string | undefined, modeId: string) =>
  `workbench-mode:${JSON.stringify([projectId ?? null, modeId])}`;
const isModePlacement = (placement: WorkbenchWidgetPlacement, region: (typeof workbenchRegions)[number]) =>
  region !== "main" &&
  (placement.placementIdentity?.kind === "mode" || Boolean(getWorkbenchModePanelForRegion(region)));

const legacyMainOwner = (input: {
  layout: WorkbenchLayout;
  context: WorkbenchPagePersistenceScopeInput;
  pages: readonly WorkbenchPageContribution[];
  saved?: PageLocation;
  scope?: string;
  resolveScope: createWorkbenchInput["resolvePagePersistenceScope"];
}) => {
  const { context, pages, saved } = input;
  const routed = Object.values(input.layout.regions)
    .flatMap((region) => region.widgets)
    .find((widget) => widget.widgetId === input.layout.activeLocationWidgetId);
  const captured =
    saved && pages.find((page) => page.ref.id === saved.page.id && page.ref.extensionId === saved.page.extensionId);
  if (captured && (!routed?.resource?.projectId || routed.resource.projectId === context.projectId)) {
    const owner = {
      projectId: context.projectId,
      modeId: captured.modeId,
      pageId: captured.id,
      resource: saved.resource,
    };
    if (input.resolveScope?.(owner)?.scope === input.scope) return { context: owner, page: captured };
  }
  if (!routed || routed.placementIdentity?.kind !== "page") return undefined;
  const pageId = routed.placementIdentity.pageId;
  const page = pages.find((page) => page.id === pageId);
  if (!page) return undefined;
  return {
    context: {
      projectId: routed.resource?.projectId ?? context.projectId,
      modeId: page.modeId,
      pageId,
      resource: page.resource ? routed.resource : undefined,
    },
    page,
  };
};

/** Main tabs and header choices belong to a page. Auxiliary tabs and geometry belong to its project/mode. */
export const createWorkbenchLayoutCache = (
  input: createWorkbenchInput,
  getActiveMode: () => string | undefined = () => undefined,
  getTab: (contributionId: string) => WorkbenchWidgetPlacement["tab"] = () => undefined,
  getPages: () => readonly WorkbenchPageContribution[] = () => [],
  migratePanelView?: MigratePagePanelView,
) => {
  const { pageMainOwner, pageMainScope } = createPageMainScopes(getPages);
  const memory = new Map<string | undefined, WorkbenchLayout>();
  const inventory = createOpenPlacementInventory();
  let restored = false;
  let knownPages = getPages();
  const adapter: LayoutPersistenceAdapter = input.persistence
    ? {
        getLayout: (scope) => input.persistence?.getSnapshot(scope)?.layout,
        setLayout: (layout, scope) => input.persistence?.setSnapshot({ layout }, scope),
        removeLayout: input.persistence.removeSnapshot
          ? (scope) => input.persistence?.removeSnapshot?.(scope)
          : undefined,
        listLayouts: () => input.persistence?.listLayouts?.() ?? [],
        onDidChangeLayout: input.persistence?.onDidChangeLayout,
        flush: input.persistence.flush,
        dispose: input.persistence.dispose,
      }
    : (input.layoutPersistence ?? {
        getLayout: (scope) => memory.get(scope),
        setLayout: (layout, scope) => memory.set(scope, layout),
        removeLayout: (scope) => {
          memory.delete(scope);
        },
      });
  const remember = (scope: string | undefined, layout: WorkbenchLayout | undefined) => {
    const normalized = layout ? prunePageContentLayout(scope, layout, getPages(), migratePanelView) : undefined;
    if (normalized && normalized !== layout)
      runWorkbenchEffect("page content layout migration", () => adapter.setLayout(normalized, scope));
    inventory.set(scope, normalized);
    return normalized;
  };
  const stopInventory = adapter.onDidChangeLayout?.((scope, layout) => remember(scope, layout));
  const read = (scope?: string) => {
    const saved = runWorkbenchEffect(`layout cache read for ${scope ?? "unscoped"}`, () => adapter.getLayout(scope));
    const layout = remember(scope, saved);
    return layout ? restoreLayoutPresentation(layout, getTab) : undefined;
  };
  const write = (layout: WorkbenchLayout, scope?: string) => {
    return runWorkbenchEffect(`layout cache write for ${scope ?? "unscoped"}`, () => {
      const normalized = prunePageContentLayout(scope, layout, getPages(), migratePanelView);
      adapter.setLayout(normalized, scope);
      inventory.set(scope, normalized);
      return true;
    });
  };
  const clear = (scope: string, fallback: WorkbenchLayout) => {
    runWorkbenchEffect(`remove default page layout for ${scope}`, () => {
      if (adapter.removeLayout) adapter.removeLayout(scope);
      else if (adapter.getLayout(scope)) adapter.setLayout(fallback, scope);
    });
    inventory.set(scope, adapter.removeLayout ? undefined : adapter.getLayout(scope));
  };
  const headers = createPageHeaderCache({ read, write, clear });
  const migratePageMain = (
    layout: WorkbenchLayout,
    context: WorkbenchPagePersistenceScopeInput,
    page: WorkbenchPageContribution | undefined,
    scope: string | undefined,
  ) => {
    const owner = legacyMainOwner({
      layout,
      context,
      pages: page ? [page, ...getPages()] : getPages(),
      saved: context.projectId ? input.pageLocationPersistence?.load(context.projectId)?.location : undefined,
      scope,
      resolveScope: input.resolvePagePersistenceScope,
    });
    if (!owner) return;
    const ownerScope = pageMainScope(owner.context, owner.page);
    // The captured route owns the whole tray, including tabs created elsewhere.
    // Consume the old scope once; an existing empty owner entry remains authoritative.
    if (
      !read(ownerScope) &&
      !write(
        selectPlacements(layout, (_widget, region) => region === "main"),
        ownerScope,
      )
    )
      return;
    write(
      selectPlacements(layout, (_widget, region) => region !== "main"),
      scope,
    );
  };
  const restoreInventory = (current: WorkbenchLayout) => {
    const pages = getPages();
    if (pages.length !== knownPages.length || pages.some((page, index) => page !== knownPages[index])) {
      knownPages = pages;
      restored = false;
    }
    if (!restored) {
      restored = true;
      for (const { scope, layout } of adapter.listLayouts?.() ?? []) remember(scope, layout);
    }
    inventory.setCurrent(current);
  };
  return {
    listPlacements(current: WorkbenchLayout) {
      restoreInventory(current);
      return inventory.getPlacements();
    },
    placementIds(current: WorkbenchLayout) {
      restoreInventory(current);
      return inventory.getIds();
    },
    listResources(current: WorkbenchLayout) {
      restoreInventory(current);
      return inventory.getResources();
    },
    hasPageMain(context: WorkbenchPagePersistenceScopeInput, page: WorkbenchPageContribution) {
      if (isSingleViewPage(page)) return false;
      return Boolean(read(pageMainScope(context, page)));
    },
    loadPageLayout(context: WorkbenchPagePersistenceScopeInput, page: WorkbenchPageContribution | undefined) {
      const scope = input.resolvePagePersistenceScope?.(context)?.scope;
      const layout = read(scope);
      if (!context.pageId || !context.modeId) return layout;
      if (layout?.regions.main.widgets.length) migratePageMain(layout, context, page, scope);
      const owner = pageMainOwner(context, page);
      if (owner.page?.main.kind === "panels" && !owner.page.resource)
        migrateCollectionMain({
          context: owner.context,
          page: owner.page,
          pages: getPages(),
          scope: pageMainScope(context, page),
          preferredScope: mainScope(context, page),
          layouts: adapter.listLayouts?.() ?? [],
          read,
          write,
          clear,
        });
      const main = isSingleViewPage(page) ? undefined : read(pageMainScope(context, page));
      const pageHeaders = headers.load(context);
      return assemblePageLayout(layout, main, pageHeaders);
    },
    savePageMain(
      context: WorkbenchPagePersistenceScopeInput,
      layout: WorkbenchLayout,
      page: WorkbenchPageContribution | undefined,
      beforePreviewRemoval = layout,
    ) {
      if (!context.pageId || !context.modeId) return;
      headers.save(context, layout);
      const scope = pageMainScope(context, page);
      const snapshot = selectPlacements(layout, (_widget, region) => region === "main");
      if (isSingleViewPage(page)) {
        clear(scope, snapshot);
        return;
      }
      const owner = pageMainOwner(context, page);
      const isBaseline = (candidate: WorkbenchLayout) =>
        isDefaultPageMain(owner.page, owner.context.resource, candidate, input.pageResources) &&
        isDefaultPageMain(page, context.resource, candidate, input.pageResources);
      if (isBaseline(layout) || (beforePreviewRemoval !== layout && isBaseline(beforePreviewRemoval))) {
        // The live layout owns its default tabs. Saving a baseline must not
        // turn a visited page into another owner after that tray is replaced.
        clear(scope, snapshot);
      } else write(snapshot, scope);
    },
    removeResource(resource: ResourceRef) {
      if (!restored) {
        restored = true;
        for (const { scope, layout } of adapter.listLayouts?.() ?? []) remember(scope, layout);
      }
      for (const scope of inventory.getScopes(resource)) {
        const layout = read(scope);
        if (layout) {
          const remaining = selectPlacements(
            layout,
            (placement) => resourceKey(placement.resource) !== resourceKey(resource),
          );
          for (const region of Object.values(remaining.regions))
            region.widgets = region.widgets.map((widget) =>
              removeViewContextResources(widget, getPages(), (value) => resourceKey(value) === resourceKey(resource)),
            );
          write(remaining, scope);
        } else inventory.removeResource(scope, resource);
      }
    },
    layout: {
      ...adapter,
      dispose() {
        stopInventory?.();
        adapter.dispose?.();
      },
      getLayout: read,
      setLayout: (layout: WorkbenchLayout, scope?: string) => {
        const snapshot = selectPlacements(
          layout,
          (p, region) => !getActiveMode() || (region !== "main" && !isModePlacement(p, region)),
        );
        for (const id of workbenchRegions) {
          snapshot.regions[id].savedWidgetOrder = layout.regions[id].widgets.map((widget) => widget.widgetId);
        }
        return write(snapshot, scope);
      },
    },
    readMode: (projectId: string | undefined, modeId: string) => read(modeScope(projectId, modeId)),
    saveMode: (projectId: string | undefined, modeId: string, layout: WorkbenchLayout) =>
      write(
        selectPlacements(
          layout,
          (p, region) =>
            isModePlacement(p, region) &&
            (p.placementIdentity?.kind !== "mode" || p.placementIdentity.modeId === modeId),
        ),
        modeScope(projectId, modeId),
      ),
  };
};
