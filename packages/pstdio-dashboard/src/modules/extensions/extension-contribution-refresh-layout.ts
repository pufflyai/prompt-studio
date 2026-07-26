import {
  getWorkbenchModePanelForRegion,
  isWorkbenchModePanelAvailable,
  type WorkbenchLayout,
  type WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";

interface ExtensionContributionRefreshLayout {
  activeModeId: string | undefined;
  layout: WorkbenchLayout;
}

export const captureExtensionContributionRefreshLayout = (
  ctx: WorkbenchModuleContributionContext,
): ExtensionContributionRefreshLayout => ({
  activeModeId: ctx.modes.getActiveModeId(),
  layout: ctx.layout.getLayout(),
});

const sanitizeLayout = (ctx: WorkbenchModuleContributionContext, snapshot: ExtensionContributionRefreshLayout) => {
  const mode = snapshot.activeModeId ? ctx.modes.getMode(snapshot.activeModeId) : undefined;
  const regions = Object.fromEntries(
    Object.entries(snapshot.layout.regions).map(([regionId, region]) => {
      const modePanel = getWorkbenchModePanelForRegion(region.id);
      const available = !modePanel || isWorkbenchModePanelAvailable(mode, modePanel);
      const widgets = available
        ? region.widgets.filter((placement) => Boolean(ctx.layout.getWidget(placement.contributionId)))
        : [];
      return [
        regionId,
        {
          ...region,
          widgets,
          activeWidgetId: widgets.some((placement) => placement.widgetId === region.activeWidgetId)
            ? region.activeWidgetId
            : widgets[0]?.widgetId,
          visible: available && region.visible,
        },
      ];
    }),
  ) as WorkbenchLayout["regions"];
  const placements = Object.values(regions).flatMap((region) => region.widgets);
  const hasPlacement = (widgetId: string | undefined) =>
    Boolean(widgetId && placements.some((placement) => placement.widgetId === widgetId));
  const retainedWidgetIds = new Set(placements.map((placement) => placement.widgetId));
  const locationSubPanelSelections = Object.fromEntries(
    Object.entries(snapshot.layout.locationSubPanelSelections ?? {}).map(([resourceUri, selections]) => [
      resourceUri,
      Object.fromEntries(Object.entries(selections).filter(([, widgetId]) => retainedWidgetIds.has(widgetId))),
    ]),
  );

  return {
    ...snapshot.layout,
    regions,
    activeWidgetId: hasPlacement(snapshot.layout.activeWidgetId) ? snapshot.layout.activeWidgetId : undefined,
    activeLocationWidgetId: hasPlacement(snapshot.layout.activeLocationWidgetId)
      ? snapshot.layout.activeLocationWidgetId
      : undefined,
    activeResourceUri: hasPlacement(snapshot.layout.activeWidgetId) ? snapshot.layout.activeResourceUri : undefined,
    locationSubPanelSelections,
  };
};

export const restoreExtensionContributionRefreshLayout = (
  ctx: WorkbenchModuleContributionContext,
  snapshot: ExtensionContributionRefreshLayout,
) => {
  const activeModeWasRemoved =
    snapshot.activeModeId !== undefined &&
    ctx.modes.getActiveModeId() === undefined &&
    ctx.modes.getMode(snapshot.activeModeId) === undefined;
  if (activeModeWasRemoved) return;

  if (snapshot.activeModeId && ctx.modes.getActiveModeId() !== snapshot.activeModeId) {
    ctx.modes.setActiveMode(snapshot.activeModeId);
  }
  ctx.layout.restoreLayout(sanitizeLayout(ctx, snapshot));
};
