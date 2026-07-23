import {
  buildUpdatedPlacement,
  createPlacement,
  createUniqueWidgetId,
  findPlacement,
  findResourcePlacement,
  getActiveLocationPlacement,
  replaceRegionWidgets,
} from "./layout-operations";
import { placeWidget } from "./layout-tab-lifecycle";
import type {
  OpenWidgetInput,
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchRegion,
  WorkbenchWidgetPlacement,
} from "./layout-types";

interface CreateWidgetOpenersInput {
  getLayout(): WorkbenchLayout;
  requireWidget(id: string): RegisteredWidgetContribution;
  applyAndActivate(
    layout: WorkbenchLayout,
    regionId: WorkbenchRegion,
    placement: WorkbenchWidgetPlacement,
  ): WorkbenchWidgetPlacement;
}

const findReusablePlacement = (
  widget: RegisteredWidgetContribution,
  layout: WorkbenchLayout,
  openInput: OpenWidgetInput,
) => {
  if (!widget.singleton && widget.reuse === "none") return undefined;
  if (widget.role === "sub-panel" || widget.role === "panel-menu") {
    const ownerResourceUri = getActiveLocationPlacement(layout)?.resourceUri;
    for (const region of Object.values(layout.regions)) {
      const index = region.widgets.findIndex(
        (candidate) =>
          candidate.contributionId === widget.id &&
          candidate.ownerResourceUri === ownerResourceUri &&
          (!openInput.resource || candidate.resourceUri === openInput.resource.uri),
      );
      if (index >= 0) return { regionId: region.id, index, placement: region.widgets[index] };
    }
    return undefined;
  }
  if (widget.singleton) return findPlacement(layout, widget.id);
  if (openInput.resource) return findResourcePlacement(layout, widget.id, openInput.resource.uri);
  return findPlacement(layout, widget.id);
};

const findReplacementIndex = (
  layout: WorkbenchLayout,
  regionId: WorkbenchRegion,
  widget: RegisteredWidgetContribution,
  openInput: OpenWidgetInput,
) => {
  const region = layout.regions[regionId];
  const activeWidgetId = widget.role === "location" ? layout.activeLocationWidgetId : region.activeWidgetId;

  if (openInput.replaceWidgetId) {
    return region.widgets.findIndex((placement) => placement.widgetId === openInput.replaceWidgetId);
  }
  if (openInput.tabRetention === "preview") {
    return region.widgets.findIndex((placement) => placement.tabRetention === "preview");
  }
  if (!openInput.replaceActive) return -1;
  return region.widgets.findIndex((placement) => placement.widgetId === activeWidgetId && !placement.pinned);
};

export const createWidgetOpeners = (input: CreateWidgetOpenersInput) => {
  const { getLayout, requireWidget, applyAndActivate } = input;

  const bindToActiveLocation = (
    placement: WorkbenchWidgetPlacement,
    widget: RegisteredWidgetContribution,
    layout: WorkbenchLayout,
  ) => {
    if (widget.role !== "sub-panel" && widget.role !== "panel-menu") return placement;
    return { ...placement, ownerResourceUri: getActiveLocationPlacement(layout)?.resourceUri };
  };

  const updateSingleton = (
    widget: RegisteredWidgetContribution,
    existing: NonNullable<ReturnType<typeof findPlacement>>,
    openInput: OpenWidgetInput,
  ) => {
    const nextPlacement = bindToActiveLocation(
      buildUpdatedPlacement(existing.placement, widget, openInput),
      widget,
      getLayout(),
    );
    const layout = replaceRegionWidgets(getLayout(), existing.regionId, (widgets) => {
      const updated = widgets.map((current, index) => (index === existing.index ? nextPlacement : current));
      if (!openInput.tabPosition) return updated;
      return placeWidget(
        updated.filter((placement) => placement.widgetId !== nextPlacement.widgetId),
        nextPlacement,
        openInput.tabPosition,
      );
    });
    return applyAndActivate(layout, existing.regionId, nextPlacement);
  };

  const replaceActive = (
    widget: RegisteredWidgetContribution,
    regionId: WorkbenchRegion,
    replacementIndex: number,
    replacement: WorkbenchWidgetPlacement,
    openInput: OpenWidgetInput,
  ) => {
    const nextPlacement = bindToActiveLocation(
      buildUpdatedPlacement(replacement, widget, openInput),
      widget,
      getLayout(),
    );
    const layout = replaceRegionWidgets(getLayout(), regionId, (widgets) => {
      const updated = widgets.map((current, index) => (index === replacementIndex ? nextPlacement : current));
      if (nextPlacement.tabRetention !== "preview") return updated;
      return placeWidget(updated, nextPlacement, "start");
    });
    return applyAndActivate(layout, regionId, nextPlacement);
  };

  const reuseExistingPlacement = (
    widget: RegisteredWidgetContribution,
    existing: NonNullable<ReturnType<typeof findPlacement>>,
    regionId: WorkbenchRegion,
    replacementIndex: number,
    openInput: OpenWidgetInput,
  ) => {
    if (openInput.tabRetention === "preview" && existing.placement.tabRetention !== "preview") {
      return applyAndActivate(getLayout(), existing.regionId, existing.placement);
    }

    if (existing.regionId !== regionId) {
      const nextPlacement = bindToActiveLocation(
        buildUpdatedPlacement(existing.placement, widget, openInput),
        widget,
        getLayout(),
      );
      const withoutExisting = replaceRegionWidgets(
        getLayout(),
        existing.regionId,
        (widgets) => widgets.filter((_current, index) => index !== existing.index),
        { clearActiveWidget: getLayout().regions[existing.regionId].activeWidgetId === existing.placement.widgetId },
      );
      const layout = replaceRegionWidgets(withoutExisting, regionId, (widgets) => {
        if (replacementIndex < 0) return placeWidget(widgets, nextPlacement, openInput.tabPosition);
        const copy = [...widgets];
        copy.splice(replacementIndex, 1, nextPlacement);
        return nextPlacement.tabRetention === "preview" ? placeWidget(copy, nextPlacement, "start") : copy;
      });
      return applyAndActivate(layout, regionId, nextPlacement);
    }

    if (replacementIndex < 0 || existing.index === replacementIndex) {
      return updateSingleton(widget, existing, openInput);
    }

    const nextPlacement = bindToActiveLocation(
      buildUpdatedPlacement(existing.placement, widget, openInput),
      widget,
      getLayout(),
    );
    const layout = replaceRegionWidgets(getLayout(), regionId, (widgets) =>
      placeWidget(
        widgets
          .map((current, index) => (index === existing.index ? nextPlacement : current))
          .filter((_current, index) => index !== replacementIndex && index !== existing.index),
        nextPlacement,
        openInput.tabPosition,
      ),
    );
    return applyAndActivate(layout, regionId, nextPlacement);
  };

  const insertWidget = (
    widget: RegisteredWidgetContribution,
    regionId: WorkbenchRegion,
    replacementIndex: number,
    openInput: OpenWidgetInput,
  ) => {
    const widgetId = createUniqueWidgetId(getLayout(), widget.id);
    const placement = bindToActiveLocation(createPlacement(widgetId, widget, openInput), widget, getLayout());
    const layout = replaceRegionWidgets(getLayout(), regionId, (widgets) => {
      if (replacementIndex < 0) return placeWidget(widgets, placement, openInput.tabPosition);
      const copy = [...widgets];
      copy.splice(replacementIndex, 1, placement);
      return placement.tabRetention === "preview" ? placeWidget(copy, placement, "start") : copy;
    });
    return applyAndActivate(layout, regionId, placement);
  };

  const openWidget = (id: string, openInput: OpenWidgetInput = {}): WorkbenchWidgetPlacement => {
    const widget = requireWidget(id);
    const layout = getLayout();
    const regionId = openInput.region ?? widget.region ?? widget.fallbackRegion ?? "main";
    const region = layout.regions[regionId];
    const replacementIndex = findReplacementIndex(layout, regionId, widget, openInput);
    const replacement = replacementIndex >= 0 ? region.widgets[replacementIndex] : undefined;
    const existing =
      openInput.replaceWidgetId && replacement ? undefined : findReusablePlacement(widget, layout, openInput);

    let placement: WorkbenchWidgetPlacement;
    if (existing) placement = reuseExistingPlacement(widget, existing, regionId, replacementIndex, openInput);
    else if (replacement?.contributionId === widget.id) {
      placement = replaceActive(widget, regionId, replacementIndex, replacement, openInput);
    } else {
      placement = insertWidget(widget, regionId, replacementIndex, openInput);
    }

    for (const panelMenuId of widget.ownedPanelMenuIds ?? []) {
      openWidget(panelMenuId, { pinned: true });
    }
    return applyAndActivate(getLayout(), regionId, placement);
  };

  return { openWidget };
};
