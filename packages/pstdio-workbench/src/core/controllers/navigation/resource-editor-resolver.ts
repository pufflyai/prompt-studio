import type { ResourceRef } from "@pstdio/sdk/extensions";
import { contributionRefId, resourceKey } from "@pstdio/sdk/extensions";
import type {
  OpenWidgetInput,
  RegisteredWidgetContribution,
  WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-types";
import { placementIdentityKey, type ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { resolvePageMode } from "../../registries/pages/page-availability";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { shellPlacementContributionId } from "../../registries/placements/shell-placement-registry";
import { modePlacementContributionId, pagePlacementContributionId } from "../../registries/views/view-placement";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { revealPanelRegion } from "../../workbench-core-navigation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { openOwnerLayouts } from "../page-runtime/open-owner-layouts";
import { pageOwnerScope } from "../page-runtime/prepared-owner-states";
import {
  findPreparedResourceEditor,
  hasPreparedEditorOwner,
  isResourceEditorInOwner,
} from "./prepared-resource-editor";
import {
  applyResourceEditorIntent,
  applyResourceEditorSourceTarget,
  type ResourceEditorIntent,
  resourceEditorIntent,
} from "./resource-editor-intent";
import { resourceEditorOwnerTarget } from "./resource-editor-owner-target";
import { resourceEditorTarget } from "./resource-editor-target";

export const findOpenEditor = (core: WorkbenchCore, matches: (tab: WorkbenchWidgetPlacement) => boolean) =>
  openOwnerLayouts(core).flatMap((owner) =>
    Object.values(owner.layout.regions).flatMap((region) =>
      region.widgets
        .filter((tab) => core.layout.getWidget(tab.contributionId) && matches(tab))
        .map((tab) => ({ ...owner, region: region.id, tab })),
    ),
  )[0];

export const findOpenResourceEditor = (core: WorkbenchCore, viewId: string, resource: ResourceRef) => {
  if (core.views.getView(viewId)?.instancePolicy !== "per-resource") return undefined;
  const normalized = getWorkbenchPageRegistryInternals(core.pages).resources.normalize(resource);
  return findOpenEditor(core, (tab) => tab.viewId === viewId && resourceKey(tab.resource) === resourceKey(normalized));
};

export const findOtherOwnedResourceEditor = (
  core: WorkbenchCore,
  placement: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const { viewId, resource } = placement.value;
  const found = viewId && resource ? findOpenResourceEditor(core, viewId, resource) : undefined;
  if (!found) return undefined;
  const sameIdentity =
    found.tab.placementIdentity &&
    placementIdentityKey(found.tab.placementIdentity) === placementIdentityKey(placement.identity);
  if (sameIdentity && (placement.identity.kind !== "page" || found.scope === pageOwnerScope(state))) return undefined;
  return found.tab.widgetId;
};

export type OpenResourceEditor = Pick<
  NonNullable<ReturnType<typeof findOpenResourceEditor>>,
  "scope" | "region" | "tab"
>;

const liveEditorPlacement = (core: WorkbenchCore, editor: OpenResourceEditor) =>
  Object.values(core.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .find(
      (tab) =>
        resourceKey(tab.resource) === resourceKey(editor.tab.resource) &&
        (tab.widgetId === editor.tab.widgetId ||
          (tab.placementIdentity &&
            editor.tab.placementIdentity &&
            placementIdentityKey(tab.placementIdentity) === placementIdentityKey(editor.tab.placementIdentity))),
    );

export const prepareEditorActivation = (
  core: WorkbenchCore,
  editor: OpenResourceEditor,
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[] = [],
  current = core.pages.store.getState(),
  intent: ResourceEditorIntent = resourceEditorIntent(targets.at(-1)),
) => {
  const pages = getWorkbenchPageRegistryInternals(core.pages);
  const locations = getPageLocationPreparation<WorkbenchWidgetPlacement>(core.pageLocations);
  const resource = intent.resource ? pages.resources.normalize(intent.resource) : undefined;
  const requestedEditor = resource ? { ...editor, tab: { ...editor.tab, resource } } : editor;
  const target = resourceEditorOwnerTarget(core, requestedEditor, targets, current);
  const resolved = target ? locations.resolve(target, current.activeModeId) : undefined;
  const ownerMode = editor.tab.placementIdentity?.kind === "mode" ? editor.tab.placementIdentity.modeId : undefined;
  const modeId =
    ownerMode ??
    (resolved
      ? resolvePageMode(current.pages[resolved.pageId]!, resolved.location.mode, current.activeModeId)
      : current.activeModeId);
  const policy = core.shell.getPanelPolicy(editor.region, {
    modeId,
    pageId: resolved?.pageId ?? current.activePageId,
    projectId: current.projectId,
    resource: resolved ? resolved.location.resource : current.location?.resource,
  });
  if (!policy.provided || (!policy.open && !policy.canOpen))
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
  return {
    state,
    target,
    region: editor.region,
    identity: editor.tab.placementIdentity,
    tab: editor.tab,
    resource,
    intent,
    applyIntent: () =>
      applyResourceEditorIntent(core, editor.tab, editor.scope, liveEditorPlacement(core, editor), {
        ...intent,
        resource,
      }),
    applySourceTarget: () =>
      applyResourceEditorSourceTarget(core, editor.tab, editor.scope, liveEditorPlacement(core, editor), intent),
    isInOwner(state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) {
      return isResourceEditorInOwner(editor, state);
    },
    activate() {
      const tab = liveEditorPlacement(core, editor);
      if (!tab) throw new Error(`Editor is no longer open: ${editor.tab.widgetId}`);
      applyResourceEditorIntent(core, editor.tab, editor.scope, tab, { ...intent, resource });
      revealPanelRegion(core, editor.region);
      core.layout.activatePanel(tab.widgetId);
      core.focus.setActiveRegion(
        editor.region === "main" ||
          editor.region === "bottom" ||
          editor.region === "aside" ||
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

const legacyDeclaredEditor = (
  core: WorkbenchCore,
  target: NavigationTargetPage | NavigationTargetPanel,
  match: ReturnType<typeof resourceEditorTarget>,
  current: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  states: readonly WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[],
) => {
  if (target.kind !== "panel" || !match) return undefined;
  const editor = findCurrentDeclaredEditor(core, target, match.resource);
  if (editor && (!isResourceEditorInOwner(editor, current) || hasPreparedEditorOwner(editor, states))) return undefined;
  return editor;
};

export const prepareExistingResourceEditor = (
  core: WorkbenchCore,
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[],
  current = core.pages.store.getState(),
  preparedStates: readonly WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[] = [],
) => {
  for (const target of [...targets].reverse()) {
    const match = resourceEditorTarget(core, target);
    const states = preparedStates.length || current !== core.pages.store.getState() ? [...preparedStates, current] : [];
    const live = match ? findOpenResourceEditor(core, match.viewId, match.resource) : undefined;
    const unique = live && !hasPreparedEditorOwner(live, states) ? live : undefined;
    const pending =
      match && states.length ? findPreparedResourceEditor(core, match.viewId, match.resource, states) : undefined;
    const legacy = legacyDeclaredEditor(core, target, match, current, states);
    const editor = unique ?? pending?.editor ?? legacy;
    if (editor) {
      const ownerTargets = !unique && pending?.owner ? [pending.owner, ...targets] : targets;
      return prepareEditorActivation(core, editor, ownerTargets, current);
    }
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
    prepareEditorActivation(core, editor, [], undefined, {
      open: intent,
      resource: input.resource,
      title: input.title,
    }).commit();
    return liveEditorPlacement(core, editor)!;
  };
