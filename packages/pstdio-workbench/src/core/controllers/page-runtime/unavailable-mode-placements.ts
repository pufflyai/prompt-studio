import {
  type WorkbenchLayout,
  type WorkbenchWidgetPlacement,
  workbenchRegions,
} from "../../registries/layout/layout-types";

/** An unloaded declaration cannot authoritatively close its saved tabs. Registered owners can. */
export const retainUnavailableModePlacements = (
  current: WorkbenchLayout,
  previous: WorkbenchLayout | undefined,
  modeId: string,
  registered: ReadonlySet<string>,
  activatedWidgetId?: string,
) => {
  if (!previous) return current;
  const regions = { ...current.regions };
  for (const id of workbenchRegions) {
    if (id === "main") continue;
    const region = current.regions[id];
    const known = new Set(region.widgets.map((widget) => widget.widgetId));
    const before = new Map<string | undefined, WorkbenchWidgetPlacement[]>();
    let anchor: string | undefined;
    for (const widget of [...previous.regions[id].widgets].reverse()) {
      if (known.has(widget.widgetId)) {
        anchor = widget.widgetId;
        continue;
      }
      const owner = widget.placementIdentity;
      if (owner?.kind !== "mode" || owner.modeId !== modeId || registered.has(owner.placementId)) continue;
      const bucket = before.get(anchor) ?? [];
      bucket.push(widget);
      before.set(anchor, bucket);
    }
    const pending = (key?: string) => [...(before.get(key) ?? [])].reverse();
    const widgets = region.widgets.flatMap((widget) => [...pending(widget.widgetId), widget]).concat(pending());
    const savedSelection = previous.regions[id].widgets.find(
      (widget) => widget.widgetId === previous.regions[id].activeWidgetId,
    );
    const pendingSelection =
      savedSelection?.placementIdentity?.kind === "mode" &&
      !registered.has(savedSelection.placementIdentity.placementId) &&
      !region.widgets.some((widget) => widget.widgetId === activatedWidgetId);
    regions[id] = {
      ...region,
      widgets,
      activeWidgetId: pendingSelection
        ? savedSelection.widgetId
        : (region.activeWidgetId ??
          widgets.find((widget) => widget.widgetId === previous.regions[id].activeWidgetId)?.widgetId),
    };
  }
  return { ...current, regions };
};
