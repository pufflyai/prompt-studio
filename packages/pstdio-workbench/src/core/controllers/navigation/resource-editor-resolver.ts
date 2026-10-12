import type { PageOpenIntent, ResourceRef } from "@pstdio/sdk/extensions";
import { contributionRefId, resourceKey } from "@pstdio/sdk/extensions";
import { findPlacementByWidgetId } from "../../registries/layout/layout-operations";
import type {
  OpenWidgetInput,
  RegisteredWidgetContribution,
  WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-types";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { shellPlacementContributionId } from "../../registries/placements/shell-placement-registry";
import { modePlacementContributionId, pagePlacementContributionId } from "../../registries/views/view-placement";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { revealPanelRegion } from "../../workbench-core-navigation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { openOwnerLayouts, pageOwnerLocation } from "../page-runtime/open-owner-layouts";
import { pageLayoutScope } from "../page-runtime/owner-layout-scope";

export const findOpenEditor = (core: WorkbenchCore, matches: (tab: WorkbenchWidgetPlacement) => boolean) =>
  openOwnerLayouts(core).flatMap((owner) =>
    Object.values(owner.layout.regions).flatMap((region) =>
      region.widgets.filter(matches).map((tab) => ({ ...owner, region: region.id, tab })),
    ),
  )[0];

export const findOpenResourceEditor = (core: WorkbenchCore, viewId: string, resource: ResourceRef) => {
  if (core.views.getView(viewId)?.instancePolicy !== "per-resource") return undefined;
  const normalized = getWorkbenchPageRegistryInternals(core.pages).resources.normalize(resource);
  return findOpenEditor(core, (tab) => tab.viewId === viewId && resourceKey(tab.resource) === resourceKey(normalized));
};

const panelTargetItem = (core: WorkbenchCore, target: NavigationTargetPanel) => {
  const panel = target.panel;
  if (panel.kind === "placement") return core.modePlacements.getPlacement(panel)?.item;
  if (panel.kind === "shell-placement") return core.shellPlacements.getPlacement(panel.id)?.item;
  return core.pages
    .listPages()
    .find((p) => contributionRefId(p.ref) === contributionRefId(panel.page))
    ?.slots.find((s) => s.id === panel.id)?.item;
};

export const resourceEditorTarget = (core: WorkbenchCore, target: NavigationTargetPage | NavigationTargetPanel) => {
  if (!target.resource) return undefined;
  if (target.kind === "page") {
    const page = core.pages.listPages().find((p) => contributionRefId(p.ref) === contributionRefId(target.page));
    if (!page?.resource || !resourceMatchesConstraint(page.resource, target.resource))
      throw new Error(`Page does not accept resource kind: ${target.resource.type}`);
    return page?.main.kind === "view"
      ? { viewId: contributionRefId(page.main.view), resource: target.resource }
      : undefined;
  }
  const item = panelTargetItem(core, target);
  if (item?.kind === "binding" && !resourceMatchesConstraint(item.binding, target.resource))
    throw new Error(`Panel does not accept resource kind: ${target.resource.type}`);
  return item?.kind === "binding"
    ? { viewId: contributionRefId(item.binding.view), resource: target.resource }
    : undefined;
};

export type OpenResourceEditor = NonNullable<ReturnType<typeof findOpenResourceEditor>>;

const ownerTarget = (
  core: WorkbenchCore,
  editor: OpenResourceEditor,
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[],
  current: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const owner = editor.tab.placementIdentity;
  const explicit = targets
    .filter((t): t is NavigationTargetPage => t.kind === "page")
    .filter((t) => {
      const match = resourceEditorTarget(core, t);
      return (
        !match || match.viewId !== editor.tab.viewId || resourceKey(match.resource) !== resourceKey(editor.tab.resource)
      );
    })
    .at(-1);
  if (owner?.kind === "page") {
    const page = current.activePageId ? current.pages[current.activePageId] : undefined;
    if (
      editor.scope ===
      pageLayoutScope({
        projectId: current.projectId,
        pageId: current.activePageId,
        resource: current.location?.resource,
        page,
      })
    ) {
      if (editor.region === "main" && editor.tab.role === "location" && page?.resource && page.main.kind === "view") {
        return { kind: "page" as const, page: page.ref, resource: editor.tab.resource };
      }
      return undefined;
    }
    return editor.scope ? pageOwnerLocation(core, editor.scope) : undefined;
  }
  if (owner?.kind !== "mode" || owner.modeId === current.activeModeId) return explicit;
  const layouts = openOwnerLayouts(core);
  const mainId = editor.layout.activeLocationWidgetId;
  const lastPage = layouts.find(
    (entry) =>
      entry.scope?.includes("/owner/page/") &&
      Object.values(entry.layout.regions).some((region) => region.widgets.some((tab) => tab.widgetId === mainId)),
  );
  const home = core.pages.listPages().find((page) => page.modeId === owner.modeId && !page.resource && !page.parentId);
  const candidates = [
    explicit,
    lastPage?.scope ? pageOwnerLocation(core, lastPage.scope) : undefined,
    ...(home ? [{ kind: "page" as const, page: home.ref }] : []),
  ];
  return (
    candidates.find(
      (target) =>
        target &&
        core.pages.listPages().find((p) => contributionRefId(p.ref) === contributionRefId(target.page))?.modeId ===
          owner.modeId,
    ) ??
    (() => {
      throw new Error(`Editor owner has no available page: ${owner.modeId}`);
    })()
  );
};

export const prepareEditorActivation = (
  core: WorkbenchCore,
  editor: OpenResourceEditor,
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[] = [],
  current = core.pages.store.getState(),
  open: PageOpenIntent | undefined = targets.at(-1)?.open,
) => {
  const pages = getWorkbenchPageRegistryInternals(core.pages);
  const locations = getPageLocationPreparation<WorkbenchWidgetPlacement>(core.pageLocations);
  const target = ownerTarget(core, editor, targets, current);
  const resolved = target ? locations.resolve(target) : undefined;
  const ownerMode = editor.tab.placementIdentity?.kind === "mode" ? editor.tab.placementIdentity.modeId : undefined;
  const modeId = ownerMode ?? (resolved ? current.pages[resolved.pageId]?.modeId : current.activeModeId);
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  if (
    (editor.region === "side" || editor.region === "secondary") &&
    !isWorkbenchModePanelAvailable(mode, editor.region)
  )
    throw new Error(`Editor destination cannot open: ${editor.region}`);
  if (!core.views.getView(editor.tab.viewId ?? "") || !core.layout.getWidget(editor.tab.contributionId))
    throw new Error(`Editor destination is unavailable: ${editor.tab.widgetId}`);
  const state =
    resolved && current.projectId
      ? pages.prepare.location(
          {
            pageId: resolved.pageId,
            projectId: current.projectId,
            location: resolved.location,
            resource: resolved.location.resource,
            action: "activateResourceEditor",
          },
          current,
        )
      : current;
  const requested = targets.at(-1);
  return {
    state,
    target,
    region: editor.region,
    isInOwner(state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) {
      const owner = editor.tab.placementIdentity;
      if (owner?.kind === "mode") return owner.modeId === state.activeModeId;
      if (owner?.kind !== "page") return true;
      const page = state.activePageId ? state.pages[state.activePageId] : undefined;
      return (
        editor.scope ===
        pageLayoutScope({
          projectId: state.projectId,
          pageId: state.activePageId,
          resource: state.location?.resource,
          page,
        })
      );
    },
    activate() {
      const tab = Object.values(core.layout.getLayout().regions)
        .flatMap((r) => r.widgets)
        .find((t) => t.widgetId === editor.tab.widgetId);
      if (!tab) throw new Error(`Editor is no longer open: ${editor.tab.widgetId}`);
      if (open === "pin" && tab.placementIdentity) core.pinPlacement(tab.placementIdentity);
      if (requested?.kind === "page" && (requested.section || requested.position)) {
        const layout = core.layout.getLayout();
        core.layout.restoreLayout({
          ...layout,
          regions: {
            ...layout.regions,
            [editor.region]: {
              ...layout.regions[editor.region],
              widgets: layout.regions[editor.region].widgets.map((p) =>
                p.widgetId === tab.widgetId ? { ...p, section: requested.section, position: requested.position } : p,
              ),
            },
          },
        });
      }
      revealPanelRegion(core, editor.region);
      core.layout.activatePanel(tab.widgetId);
      core.focus.setActiveRegion(
        editor.region === "main" ||
          editor.region === "bottom" ||
          editor.region === "side" ||
          editor.region === "secondary"
          ? editor.region
          : "main",
      );
      core.focus.requestPanelFocus(tab.widgetId);
    },
    commit() {
      return batchWorkbenchChanges(() => {
        const result = locations.commit(state);
        this.activate();
        return result;
      });
    },
  };
};

const panelDeclarationId = (core: WorkbenchCore, target: NavigationTargetPanel) => {
  const panel = target.panel;
  if (panel.kind === "placement") {
    const placement = core.modePlacements.getPlacement(panel);
    return placement ? modePlacementContributionId(placement.id) : undefined;
  }
  if (panel.kind === "shell-placement") return shellPlacementContributionId(panel.id);
  const page = core.pages.listPages().find((page) => contributionRefId(page.ref) === contributionRefId(panel.page));
  return page ? pagePlacementContributionId(page.id, panel.id) : undefined;
};
const findCurrentDeclaredEditor = (core: WorkbenchCore, target: NavigationTargetPanel, resource: ResourceRef) => {
  const id = panelDeclarationId(core, target);
  const layout = core.layout.getLayout();
  for (const region of Object.values(layout.regions)) {
    const tab = region.widgets.find(
      (tab) => tab.contributionId === id && resourceKey(tab.resource) === resourceKey(resource),
    );
    if (tab) return { layout, scope: core.layout.getPersistenceScope(), region: region.id, tab };
  }
  return undefined;
};

export const prepareExistingResourceEditor = (
  core: WorkbenchCore,
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[],
  current = core.pages.store.getState(),
) => {
  for (const target of [...targets].reverse()) {
    const match = resourceEditorTarget(core, target);
    const unique = match ? findOpenResourceEditor(core, match.viewId, match.resource) : undefined;
    const editor =
      unique ??
      (target.kind === "panel" && match ? findCurrentDeclaredEditor(core, target, match.resource) : undefined);
    if (editor) return prepareEditorActivation(core, editor, targets, current);
  }
  return undefined;
};

export const createCoreWidgetResolver =
  (resolve: () => WorkbenchCore) => (widget: RegisteredWidgetContribution, input: OpenWidgetInput) => {
    if (!input.resource || input.role === "panel-menu") return undefined;
    const core = resolve();
    if (!core) return undefined;
    const editor = findOpenResourceEditor(core, input.viewId ?? widget.rendererId, input.resource);
    if (!editor) return undefined;
    const intent = input.pinned || input.tabRetention === "persistent" ? "pin" : undefined;
    prepareEditorActivation(core, editor, [], undefined, intent).commit();
    return findPlacementByWidgetId(core.layout.getLayout(), editor.tab.widgetId)!.placement;
  };
