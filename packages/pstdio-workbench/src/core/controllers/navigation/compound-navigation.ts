import type { PageSlotRef, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { resolvePageMode } from "../../registries/pages/page-availability";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { pageStateKey } from "../../registries/pages/page-state-key";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import {
  getOwnedPlacementPreparation,
  type OwnedPlacementLocationContext,
} from "../../registries/placements/owned-placement-preparation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { activateNavigationPlacement, commitPreparedNavigation } from "./navigation-commit";
import { prepareEditorOpen } from "./prepared-editor-open";
import { prepareExistingResourceEditor } from "./resource-editor-resolver";

type NavigationOperation = NavigationTargetPage | NavigationTargetPanel;

const hasStagedModeState = (
  core: WorkbenchCore,
  modeId: string,
  current: OwnedPlacementState,
  original: OwnedPlacementState,
) =>
  core.modePlacements
    .listPlacements(modeId)
    .some(
      (placement) =>
        current.staticOverrides.get(placement.id) !== original.staticOverrides.get(placement.id) ||
        current.resourceInstances.get(placement.id) !== original.resourceInstances.get(placement.id),
    );

const placementContext = (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) =>
  state.activeModeId
    ? {
        modeId: state.activeModeId,
        pageId: state.activePageId,
        projectId: state.projectId,
        location: state.location,
      }
    : undefined;
const requirePanelPage = (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>, panel: PageSlotRef) => {
  const page = Object.values(state.pages).find(
    (page) => page.ref.extensionId === panel.page.extensionId && page.ref.id === panel.page.id,
  );

  if (!page || page.id !== state.activePageId)
    throw new Error(`Page panel "${panel.id}" is not owned by the proposed page`);
  return page;
};

const restoreProposedMode = (
  core: WorkbenchCore,
  context: OwnedPlacementLocationContext,
  previous: OwnedPlacementLocationContext | undefined,
  current: OwnedPlacementState,
  original: OwnedPlacementState,
) => {
  if (hasStagedModeState(core, context.modeId, current, original)) return current;
  return getOwnedPlacementPreparation(core.modePlacements).restore?.(context, current, previous) ?? current;
};
const prepareSharedPanel = (
  core: WorkbenchCore,
  target: NavigationTargetPanel,
  modeId: string | undefined,
  modeState: OwnedPlacementState,
  shellState: OwnedPlacementState,
) => {
  const panel = target.panel;
  if (panel.kind === "placement") {
    const placement = core.modePlacements.getPlacement(panel);
    if (!placement || placement.modeId !== modeId)
      throw new Error(`Mode panel "${panel.id}" is not owned by the proposed mode`);
    const prepared = getOwnedPlacementPreparation(core.modePlacements).open(
      { placementId: placement.id, resource: target.resource, open: target.open },
      modeState,
    );
    return { modeState: prepared.state, shellState, identity: prepared.identity };
  }
  const prepared = getOwnedPlacementPreparation(core.shellPlacements).open(
    {
      placementId: panel.id,
      resource: target.resource,
      open: target.open,
      ...("title" in target ? { title: target.title } : {}),
    },
    shellState,
  );
  return { modeState, shellState: prepared.state, identity: prepared.identity };
};

const validatePanelDestination = (core: WorkbenchCore, modeId: string | undefined, region: WorkbenchRegion) => {
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  if ((region === "side" || region === "secondary") && !isWorkbenchModePanelAvailable(mode, region))
    throw new Error(`Panel destination cannot open: ${region}`);
};
const preparePanelNavigation = (
  core: WorkbenchCore,
  target: NavigationTargetPanel,
  current: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  modeState: OwnedPlacementState,
  shellState: OwnedPlacementState,
) => {
  const pages = getWorkbenchPageRegistryInternals(core.pages);
  const mode = getOwnedPlacementPreparation(core.modePlacements);
  const shell = getOwnedPlacementPreparation(core.shellPlacements);
  const panel = target.panel;
  const modeId = current.activeModeId ?? core.modes.getActiveModeId();
  const owned = (nextMode = modeState, nextShell = shellState) => ({
    mode: mode.resolve(modeId, nextMode),
    shell: shell.resolve(undefined, nextShell),
  });
  if (panel.kind === "page-slot") {
    const page = requirePanelPage(current, panel);
    const slot = page.slots.find((slot) => slot.id === panel.id);
    if (slot) validatePanelDestination(core, modeId, slot.region);
    if (slot?.isAvailable && !slot.isAvailable(current.location?.resource))
      throw new Error(`Panel cannot open: ${panel.id}`);
    const state = pages.prepare.slot(
      { pageId: page.id, slotId: panel.id, resource: target.resource, open: target.open },
      current,
      owned(),
    );
    return { state, modeState, shellState };
  }
  const declaration =
    panel.kind === "placement" ? core.modePlacements.getPlacement(panel) : core.shellPlacements.getPlacement(panel.id);
  if (declaration) validatePanelDestination(core, modeId, declaration.region);
  const prepared = prepareSharedPanel(core, target, modeId, modeState, shellState);
  const state = pages.prepare.compose(
    current,
    { ...current, activeModeId: modeId, activate: [prepared.identity], action: "preparePanelNavigation" },
    owned(prepared.modeState, prepared.shellState),
  );
  return { ...prepared, state };
};

export const prepareWorkbenchNavigation = (core: WorkbenchCore, targets: readonly NavigationOperation[]) => {
  if (!targets.length) throw new Error("Compound navigation requires at least one page or panel target");
  const pages = getWorkbenchPageRegistryInternals(core.pages);
  const locations = getPageLocationPreparation<WorkbenchWidgetPlacement>(core.pageLocations);
  const mode = getOwnedPlacementPreparation(core.modePlacements);
  const shell = getOwnedPlacementPreparation(core.shellPlacements);
  const original = core.pages.store.getState();
  const originalMode = mode.getState();
  const originalShell = shell.getState();
  let modeState = originalMode;
  let shellState = originalShell;
  let proposed = original;
  const stages: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[] = [];
  const updates: NonNullable<ReturnType<typeof prepareExistingResourceEditor>>[] = [];
  const activations = new Map<
    WorkbenchRegion,
    { identity: PlacementIdentity } | { editor: NonNullable<ReturnType<typeof prepareExistingResourceEditor>> }
  >();
  const owned = (modeId = proposed.activeModeId) => ({
    shell: shell.resolve(undefined, shellState),
    mode: mode.resolve(modeId, modeState),
  });

  const preparePage = (target: NavigationTargetPage) => {
    if (!proposed.projectId) throw new Error("Cannot navigate before a project is active");
    const resolved = locations.resolve(target, proposed.activeModeId);
    const page = proposed.pages[resolved.pageId]!;
    const modeId = resolvePageMode(page, resolved.location.mode, proposed.activeModeId);
    const stateKey = pageStateKey(page, resolved.location, pages.resources);
    const stagedPage = proposed.pageStates[stateKey] !== original.pageStates[stateKey];
    shellState =
      shell.restore?.(
        { modeId, pageId: page.id, projectId: proposed.projectId, location: resolved.location },
        shellState,
        placementContext(proposed),
      ) ?? shellState;
    modeState = restoreProposedMode(
      core,
      { modeId, pageId: page.id, location: resolved.location, projectId: proposed.projectId },
      placementContext(proposed),
      modeState,
      originalMode,
    );
    proposed = pages.prepare.location(
      {
        pageId: page.id,
        projectId: proposed.projectId,
        location: resolved.location,
        resource: resolved.location.resource,
        section: resolved.location.section,
        open: resolved.open,
        ...(stagedPage ? { pageStates: proposed.pageStates } : {}),
        action: "preparePageNavigation",
      },
      proposed,
      owned(modeId),
    );
  };

  const prepareExistingOpen = (
    existing: NonNullable<ReturnType<typeof prepareExistingResourceEditor>>,
    target: NavigationOperation,
  ) => {
    if (existing.tab.declarationIdentity) updates.push(existing);
    const retained = prepareEditorOpen(
      core,
      existing.tab,
      { open: target.open, resource: existing.resource, title: existing.intent.title },
      proposed,
      modeState,
      shellState,
    );
    proposed = retained.state;
    modeState = retained.modeState;
    shellState = retained.shellState;
  };

  for (const target of targets) {
    if (target.kind === "page") locations.resolve(target, proposed.activeModeId);
    const existing = prepareExistingResourceEditor(core, [target], proposed, stages);
    if (existing) {
      if (existing.target) preparePage(existing.target);
      prepareExistingOpen(existing, target);
      activations.delete(existing.region);
      activations.set(existing.region, { editor: existing });
      stages.push(proposed);
      continue;
    }
    if (target.kind === "page") {
      preparePage(target);
    } else if (target.kind === "panel") {
      const prepared = preparePanelNavigation(core, target, proposed, modeState, shellState);
      proposed = prepared.state;
      modeState = prepared.modeState;
      shellState = prepared.shellState;
    } else {
      throw new Error("Compound navigation accepts only page and panel targets");
    }
    stages.push(proposed);
    for (const placement of proposed.reconciliation.activate) {
      activations.delete(placement.region);
      activations.set(placement.region, { identity: placement.identity });
    }
  }
  const present = new Set(proposed.placements.map((placement) => placementIdentityKey(placement.identity)));
  const final = pages.prepare.compose(
    original,
    {
      ...proposed,
      activate: [...activations.values()].flatMap((activation) => {
        const identity = "identity" in activation ? activation.identity : activation.editor.identity;
        return identity && present.has(placementIdentityKey(identity)) ? [identity] : [];
      }),
      action: "prepareCompoundNavigation",
    },
    owned(),
  );
  return {
    commit: () =>
      commitPreparedNavigation({
        core,
        state: final,
        applyOwners: () => {
          mode.apply(modeState);
          shell.apply(shellState);
        },
        publishOwners: () => {
          pages.persistPreparedOwners(stages);
          if (modeState !== originalMode) mode.notifySubscribers();
          if (shellState !== originalShell) shell.notifySubscribers();
        },
        activateTargets: () => {
          for (const editor of updates) editor.applyIntent();
          for (const activation of activations.values()) {
            if ("editor" in activation) {
              if (activation.editor.isInOwner(final)) activation.editor.activate();
            } else if (present.has(placementIdentityKey(activation.identity))) {
              activateNavigationPlacement(core, activation.identity);
            }
          }
        },
      }),
  };
};
