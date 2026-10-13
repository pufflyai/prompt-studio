import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-types";
import { placementIdentityKey, type ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistry, WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { SINGLE_RESOURCE_INSTANCE_KEY } from "../../registries/placements/placement-instance-key";

type OwnerState = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
const ownerReaders = new WeakMap<
  WorkbenchPageRegistry<WorkbenchWidgetPlacement>,
  (state: OwnerState) => ReturnType<typeof savedOwnerPlacements>
>();

export const connectOwnerPlacementReader = (
  registry: WorkbenchPageRegistry<WorkbenchWidgetPlacement>,
  read: (state: OwnerState) => ReturnType<typeof savedOwnerPlacements>,
) => {
  ownerReaders.set(registry, read);
  return () => ownerReaders.delete(registry);
};

export const readSavedOwnerPlacements = (
  registry: WorkbenchPageRegistry<WorkbenchWidgetPlacement>,
  state: OwnerState,
) => ownerReaders.get(registry)?.(state);

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
        (placementIdentityKey(p.identity) === key && p.value.resourceKey === source.value.resourceKey) ||
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
  adopted: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[] = [],
) => {
  const modeRecords = new Map(
    records(modeLayout)
      .filter((p) => p.identity.kind === "mode")
      .map((p) => [placementIdentityKey(p.identity), p]),
  );
  for (const placement of [...records(currentLayout), ...adopted]) {
    if (placement.identity.kind === "mode" && placement.identity.modeId === modeId)
      modeRecords.set(placementIdentityKey(placement.identity), placement);
  }
  return [...modeRecords.values()];
};

export const savedOwnerPlacements = (input: {
  modeId?: string;
  pageLayout?: WorkbenchLayout;
  modeLayout?: WorkbenchLayout;
  currentLayout?: WorkbenchLayout;
  adoptedModePlacements?: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
}) => [
  ...records(input.pageLayout).filter((p) => p.identity.kind !== "mode"),
  ...savedModeRecords(input.modeId, input.modeLayout, input.currentLayout, input.adoptedModePlacements),
];

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
  const newFixedDeclaration =
    placement.value.closable === false &&
    !occupiedMain &&
    !transferredDeclarations.has(key) &&
    ((placement.identity.kind === "page" &&
      (placement.identity.slotId === "$main" ||
        page.some((p) => !p.value.declarationIdentity && p.value.contributionId === placement.value.contributionId))) ||
      (added.has(key) && !enteringPage));
  if (hasOwnerLayout && !previous && !newFixedDeclaration && !activated.has(key) && (enteringPage || !added.has(key)))
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

const restoreDeclaration = (
  placement: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>,
  previous: ResolvedOwnedPlacement<WorkbenchWidgetPlacement> | undefined,
  liveWidgetId: string | undefined,
) => {
  const widgetId = liveWidgetId ?? previous?.value.widgetId ?? placement.value.widgetId;
  return {
    ...placement,
    region: previous?.region ?? placement.region,
    value: {
      ...placement.value,
      widgetId,
    },
  };
};

const retainTransferredTab = (input: {
  placement: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>;
  previous?: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>;
  transferred?: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>;
  activated: ReadonlySet<string>;
  savedByKey: Map<string, ResolvedOwnedPlacement<WorkbenchWidgetPlacement>>;
  desired: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
  getWidget?: (id: string) => RegisteredWidgetContribution | undefined;
}) => {
  const { placement, previous, transferred, activated, savedByKey, desired, getWidget } = input;
  if (!transferred || (previous && previous.value.resourceKey === placement.value.resourceKey)) return false;
  const key = placementIdentityKey(placement.identity);
  if (activated.has(key) && placement.value.tabRetention === "persistent") {
    savedByKey.set(placementIdentityKey(transferred.identity), {
      ...transferred,
      value: { ...transferred.value, pinned: true, tabRetention: "persistent" },
    });
  }
  if (previous) {
    const restored = restoreSavedTab(previous, getWidget);
    if (restored) desired.push(restored);
    savedByKey.delete(key);
  }
  return true;
};

/** Saved owners are authoritative; declarations only seed an owner that has no layout. */
export const resolveOwnerPlacements = (input: {
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
  pageLayout?: WorkbenchLayout;
  modeLayout?: WorkbenchLayout;
  currentLayout?: WorkbenchLayout;
  liveLayout?: WorkbenchLayout;
  adoptedModePlacements?: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
  enteringPage: boolean;
  getWidget?(id: string): RegisteredWidgetContribution | undefined;
  hasDeclaration?(identity: PlacementIdentity): boolean;
}) => {
  const { state } = input;
  const page = records(input.pageLayout).filter((p) => p.identity.kind !== "mode");
  const saved = savedOwnerPlacements({ ...input, modeId: state.activeModeId });
  const transferredDeclarations = new Set(
    saved.flatMap((p) => (p.value.declarationIdentity ? [placementIdentityKey(p.value.declarationIdentity)] : [])),
  );
  const savedByKey = new Map(saved.map((p) => [placementIdentityKey(p.identity), p]));
  const added = new Set(state.reconciliation.add.map((p) => placementIdentityKey(p.identity)));
  const activated = new Set(state.reconciliation.activate.map((p) => placementIdentityKey(p.identity)));
  const removed = new Set(state.reconciliation.remove.map((placement) => placementIdentityKey(placement.identity)));
  const liveWidgets = new Map(
    records(input.liveLayout)
      .filter(
        (p) =>
          p.identity.kind === "page" &&
          p.identity.instanceKey === SINGLE_RESOURCE_INSTANCE_KEY &&
          !p.value.declarationIdentity,
      )
      .map((p) => [placementIdentityKey(p.identity), p.value.widgetId]),
  );
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
    if (
      retainTransferredTab({
        placement,
        previous,
        transferred,
        activated,
        savedByKey,
        desired,
        getWidget: input.getWidget,
      })
    )
      continue;
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
    desired.push(restoreDeclaration(placement, previous, liveWidgets.get(key)));
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
