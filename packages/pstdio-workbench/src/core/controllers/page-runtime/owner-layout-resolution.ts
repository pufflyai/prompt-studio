import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-types";
import { placementIdentityKey, type ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";

const records = (layout?: WorkbenchLayout) =>
  Object.values(layout?.regions ?? {}).flatMap((region) =>
    region.widgets.flatMap((value) =>
      value.placementIdentity
        ? [
            {
              identity: value.placementIdentity,
              region: region.id,
              order: 0,
              value,
            },
          ]
        : [],
    ),
  );

export const ownerLayoutActivation = (
  activation: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
  placements: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
) =>
  activation.flatMap((source) => {
    const key = placementIdentityKey(source.identity);
    const placement = placements.find(
      (p) =>
        placementIdentityKey(p.identity) === key ||
        (p.value.declarationIdentity &&
          placementIdentityKey(p.value.declarationIdentity) === key &&
          p.value.resourceKey === source.value.resourceKey),
    );
    return placement ? [placement] : [];
  });

const savedModeRecords = (
  modeId: string | undefined,
  modeLayout?: WorkbenchLayout,
  currentLayout?: WorkbenchLayout,
) => {
  const modeRecords = new Map(
    records(modeLayout)
      .filter((p) => p.identity.kind === "mode")
      .map((p) => [placementIdentityKey(p.identity), p]),
  );
  for (const placement of records(currentLayout)) {
    if (placement.identity.kind === "mode" && placement.identity.modeId === modeId)
      modeRecords.set(placementIdentityKey(placement.identity), placement);
  }
  return [...modeRecords.values()];
};

const canSeedDeclaration = (
  placement: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>,
  page: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
  transferredDeclarations: ReadonlySet<string>,
  added: ReadonlySet<string>,
  activated: ReadonlySet<string>,
  enteringPage: boolean,
  hasOwnerLayout: boolean,
  previous: unknown,
) => {
  const key = placementIdentityKey(placement.identity);
  const occupiedMain =
    placement.identity.kind === "page" &&
    placement.identity.slotId === "$main" &&
    page.some((p) => p.region === "main");
  const newFixedDeclaration = placement.value.closable === false && !occupiedMain && !transferredDeclarations.has(key);
  if (
    hasOwnerLayout &&
    !previous &&
    !newFixedDeclaration &&
    ((enteringPage && placement.identity.kind !== "mode") || (!added.has(key) && !activated.has(key)))
  )
    return false;
  return true;
};

const restoreSavedTab = (
  placement: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>,
  getWidget: ((id: string) => RegisteredWidgetContribution | undefined) | undefined,
) => {
  const widget = getWidget?.(placement.value.contributionId);
  if (getWidget && !widget) return undefined;
  return { ...placement, value: { ...placement.value, tab: getWidget ? widget?.tab : placement.value.tab } };
};

/** Saved owners are authoritative; declarations only seed an owner that has no layout. */
export const resolveOwnerPlacements = (input: {
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
  pageLayout?: WorkbenchLayout;
  modeLayout?: WorkbenchLayout;
  currentLayout?: WorkbenchLayout;
  enteringPage: boolean;
  getWidget?(id: string): RegisteredWidgetContribution | undefined;
  hasDeclaration?(identity: PlacementIdentity): boolean;
}) => {
  const { state } = input;
  const page = records(input.pageLayout).filter((p) => p.identity.kind !== "mode");
  const mode = savedModeRecords(state.activeModeId, input.modeLayout, input.currentLayout);
  const saved = [...page, ...mode];
  const transferredDeclarations = new Set(
    saved.flatMap((p) => (p.value.declarationIdentity ? [placementIdentityKey(p.value.declarationIdentity)] : [])),
  );
  const savedByKey = new Map(saved.map((p) => [placementIdentityKey(p.identity), p]));
  const added = new Set(state.reconciliation.add.map((p) => placementIdentityKey(p.identity)));
  const activated = new Set(state.reconciliation.activate.map((p) => placementIdentityKey(p.identity)));
  const removed = new Set(state.reconciliation.remove.map((placement) => placementIdentityKey(placement.identity)));
  const desired: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[] = [];
  for (const placement of state.placements) {
    const key = placementIdentityKey(placement.identity);
    const previous = savedByKey.get(key);
    const transferred = saved.find(
      (p) =>
        p.value.declarationIdentity &&
        placementIdentityKey(p.value.declarationIdentity) === key &&
        p.value.resourceKey === placement.value.resourceKey,
    );
    if (transferred) continue;
    const hasOwnerLayout = placement.identity.kind === "mode" ? Boolean(input.modeLayout) : Boolean(input.pageLayout);
    if (
      !canSeedDeclaration(
        placement,
        page,
        transferredDeclarations,
        added,
        activated,
        input.enteringPage,
        hasOwnerLayout,
        previous,
      )
    )
      continue;
    desired.push(
      previous
        ? { ...placement, region: previous.region, value: { ...placement.value, widgetId: previous.value.widgetId } }
        : placement,
    );
    savedByKey.delete(key);
  }
  for (const placement of savedByKey.values()) {
    if (!placement.value.declarationIdentity && input.hasDeclaration?.(placement.identity)) continue;
    if (!removed.has(placementIdentityKey(placement.identity)) || input.enteringPage) {
      const restored = restoreSavedTab(placement, input.getWidget);
      if (restored) desired.push(restored);
    }
  }
  return desired;
};
