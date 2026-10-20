import { type PageLocation, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { LayoutPersistenceAdapter } from "../../registries/layout/layout-model-types";
import { restoreLayoutPresentation } from "../../registries/layout/layout-tab-presentation";
import {
  createDefaultWorkbenchLayout,
  type WorkbenchLayout,
  type WorkbenchWidgetPlacement,
  workbenchRegions,
} from "../../registries/layout/layout-types";
import { getWorkbenchModePanelForRegion } from "../../registries/modes/mode-layout";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { pageResourceContextKey } from "../../registries/pages/page-resource-context";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { createWorkbenchInput, WorkbenchPagePersistenceScopeInput } from "../../workbench-core-types";

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
const mainScope = (context: WorkbenchPagePersistenceScopeInput, page: WorkbenchPageContribution | undefined) =>
  `workbench-main:${JSON.stringify([context.projectId, context.modeId, context.pageId, pageResourceContextKey(page, context.resource)])}`;

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

/** Main belongs to a page. Side and Bottom belong to one project/mode, regardless of their tabs' owners. */
export const createWorkbenchLayoutCache = (
  input: createWorkbenchInput,
  getActiveMode: () => string | undefined = () => undefined,
  getTab: (contributionId: string) => WorkbenchWidgetPlacement["tab"] = () => undefined,
  getPages: () => readonly WorkbenchPageContribution[] = () => [],
) => {
  // The persistence adapter does not enumerate keys. Track only scopes visited
  // by this workbench so live removal can edit their existing cached layouts.
  const scopes = new Set<string | undefined>();
  const memory = new Map<string | undefined, WorkbenchLayout>();
  const adapter: LayoutPersistenceAdapter = input.persistence
    ? {
        getLayout: (scope) => input.persistence?.getSnapshot(scope)?.layout,
        setLayout: (layout, scope) => input.persistence?.setSnapshot({ layout }, scope),
        flush: input.persistence.flush,
        dispose: input.persistence.dispose,
      }
    : (input.layoutPersistence ?? {
        getLayout: (scope) => memory.get(scope),
        setLayout: (layout, scope) => memory.set(scope, layout),
      });
  const read = (scope?: string) => {
    scopes.add(scope);
    const layout = runWorkbenchEffect(`layout cache read for ${scope ?? "unscoped"}`, () => adapter.getLayout(scope));
    return layout ? restoreLayoutPresentation(layout, getTab) : undefined;
  };
  const write = (layout: WorkbenchLayout, scope?: string) => {
    scopes.add(scope);
    return runWorkbenchEffect(`layout cache write for ${scope ?? "unscoped"}`, () => {
      adapter.setLayout(layout, scope);
      return true;
    });
  };
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
    const ownerScope = mainScope(owner.context, owner.page);
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
  return {
    loadPageLayout(context: WorkbenchPagePersistenceScopeInput, page: WorkbenchPageContribution | undefined) {
      const scope = input.resolvePagePersistenceScope?.(context)?.scope;
      const layout = read(scope);
      if (!context.pageId || !context.modeId) return layout;
      if (layout?.regions.main.widgets.length) migratePageMain(layout, context, page, scope);
      const main = read(mainScope(context, page));
      if (!layout && !main) return undefined;
      const base = layout ?? createDefaultWorkbenchLayout();
      const mainIds = new Set(main?.regions.main.widgets.map((tab) => tab.widgetId));
      return {
        ...base,
        regions: {
          ...base.regions,
          main: main?.regions.main ?? { ...base.regions.main, widgets: [], activeWidgetId: undefined },
        },
        activeWidgetId: mainIds.has(main?.activeWidgetId ?? "") ? main?.activeWidgetId : base.activeWidgetId,
        activeLocationWidgetId: mainIds.has(main?.activeLocationWidgetId ?? "")
          ? main?.activeLocationWidgetId
          : base.activeLocationWidgetId,
      };
    },
    savePageMain(
      context: WorkbenchPagePersistenceScopeInput,
      layout: WorkbenchLayout,
      page: WorkbenchPageContribution | undefined,
      location?: PageLocation,
    ) {
      if (context.pageId && context.modeId)
        write(
          {
            ...selectPlacements(layout, (_widget, region) => region === "main"),
            ownerLocation: location,
          } as WorkbenchLayout,
          mainScope(context, page),
        );
    },
    findMainEditor(projectId: string, modeId: string, matches: (placement: WorkbenchWidgetPlacement) => boolean) {
      for (const scope of scopes) {
        if (!scope?.startsWith("workbench-main:")) continue;
        const [project, mode] = JSON.parse(scope.slice("workbench-main:".length));
        if (project !== projectId || mode !== modeId) continue;
        const snapshot = read(scope) as (WorkbenchLayout & { ownerLocation?: PageLocation }) | undefined;
        const placement = snapshot?.regions.main.widgets.find(matches);
        if (placement && snapshot?.ownerLocation) return { placement, location: snapshot.ownerLocation };
      }
      return undefined;
    },
    removeResource(resource: ResourceRef) {
      for (const scope of scopes) {
        const layout = read(scope);
        if (layout)
          write(
            selectPlacements(layout, (placement) => resourceKey(placement.resource) !== resourceKey(resource)),
            scope,
          );
      }
    },
    layout: {
      ...adapter,
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
