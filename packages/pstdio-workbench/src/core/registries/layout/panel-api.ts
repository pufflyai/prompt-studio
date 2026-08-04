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
  if (!strategy) return { ...shared, tabRetention: defaultTabRetention };
  if (strategy.kind === "persistent") {
    return { ...shared, tabPosition: strategy.position, tabRetention: "persistent" };
  }
  if (strategy.kind === "replace-active") return { ...shared, replaceActive: true };
  if (strategy.kind === "replace-panel") {
    return { ...shared, replaceWidgetId: strategy.instanceId, tabRetention: strategy.retention };
  }
  return { ...shared, tabRetention: "preview", tabPosition: strategy.position };
};

export const toPanelInstance = (placement: WorkbenchWidgetPlacement): WorkbenchPanelInstance => ({
  instanceId: placement.widgetId,
  panelId: placement.contributionId,
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
  const { ownedPanelMenuIds: _ownedPanelMenuIds, role: _role, ...panel } = widget;
  return { ...panel, closable: panel.closable === true };
};
