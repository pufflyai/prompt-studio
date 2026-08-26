import type {
  OpenWidgetInput,
  OpenWorkbenchPanelInput,
  RegisteredWidgetContribution,
  WorkbenchPanelContribution,
  WorkbenchPanelInstance,
  WorkbenchTabRetention,
  WorkbenchWidgetPlacement,
} from "./layout-types";

// Without a `defaultTabRetention` the retention of an existing placement is left alone,
// so updating a panel's title never promotes a preview tab.
export const toOpenWidgetInput = (
  input: OpenWorkbenchPanelInput = {},
  defaultTabRetention?: WorkbenchTabRetention,
): OpenWidgetInput => {
  const { strategy, ...shared } = input;
  const normalized = shared.resource && shared.viewId === undefined ? { ...shared, viewId: null } : shared;
  if (!strategy) return { ...normalized, tabRetention: defaultTabRetention };
  if (strategy.kind === "persistent") {
    return { ...normalized, tabPosition: strategy.position, tabRetention: "persistent" };
  }
  if (strategy.kind === "replace-active") return { ...normalized, replaceActive: true };
  if (strategy.kind === "replace-panel") {
    return { ...normalized, replaceWidgetId: strategy.instanceId, tabRetention: strategy.retention };
  }
  return { ...normalized, tabRetention: "preview", tabPosition: strategy.position };
};

export const toPanelInstance = (placement: WorkbenchWidgetPlacement): WorkbenchPanelInstance => ({
  instanceId: placement.widgetId,
  panelId: placement.contributionId,
  viewId: placement.viewId,
  ownerId: placement.ownerId,
  source: placement.source,
  resource: placement.resource,
  resourceUri: placement.resourceUri,
  ownerResourceUri: placement.ownerResourceUri,
  title: placement.title,
  pinned: placement.pinned,
  closable: placement.closable === true,
  mountStrategy: placement.mountStrategy,
  hiddenByDefault: placement.hiddenByDefault,
  tabRetention: placement.tabRetention,
  tab: placement.tab,
});

export const toPanelContribution = (widget: RegisteredWidgetContribution): WorkbenchPanelContribution => {
  const { closable: _closable, ownedPanelMenuIds: _ownedPanelMenuIds, ...panel } = widget;
  return panel;
};
