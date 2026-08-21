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

const openOwnedPanelMenus = (input: {
  openWidget(id: string, openInput?: OpenWidgetInput): WorkbenchWidgetPlacement;
  placement: WorkbenchWidgetPlacement;
  requireWidget(id: string): RegisteredWidgetContribution;
  widget: RegisteredWidgetContribution;
}) => {
  for (const panelMenuId of input.widget.ownedPanelMenuIds ?? []) {
    const panelMenu = input.requireWidget(panelMenuId);
    input.openWidget(panelMenuId, {
      pinned: true,
      role: "panel-menu",
      resource: input.placement.resource,
      title: panelMenu.region === "main-left-menu" ? input.placement.resource?.label : panelMenu.title,
    });
  }
};

const findReusablePlacement = (
  widget: RegisteredWidgetContribution,
  layout: WorkbenchLayout,
  openInput: OpenWidgetInput,
) => {
  if (!widget.singleton && widget.reuse === "none") return undefined;
  if (openInput.role === "sub-panel" || openInput.role === "panel-menu") {
    const ownerResourceUri = getActiveLocationPlacement(layout)?.resourceUri;
    for (const region of Object.values(layout.regions)) {
      const index = region.widgets.findIndex(
        (candidate) =>
          candidate.contributionId === widget.id &&
          // Pinned placements are structural chrome, not per-location content, so they are
          // reused across location switches instead of accumulating one instance per owner.
          (candidate.pinned === true ||
            (widget.singleton && candidate.ownerResourceUri === undefined) ||
            candidate.ownerResourceUri === ownerResourceUri) &&
          (!openInput.resource ||
            (widget.singleton && candidate.resourceUri === undefined) ||
            candidate.resourceUri === openInput.resource.uri),
      );
      if (index >= 0) return { regionId: region.id, index, placement: region.widgets[index] };
    }
    return undefined;
  }
  if (widget.singleton) return findPlacement(layout, widget.id);
  if (openInput.resource) return findResourcePlacement(layout, widget.id, openInput.resource.uri);
  return findPlacement(layout, widget.id);
};

const withPlacementRole = (widget: RegisteredWidgetContribution, openInput: OpenWidgetInput): OpenWidgetInput => {
  if (openInput.role) return openInput;
  if (widget.panelMenuOwner) return { ...openInput, role: "panel-menu" };
  if (widget.eligibleLocations !== undefined) return { ...openInput, role: "sub-panel" };
  return openInput;
};

const findReplacementIndex = (layout: WorkbenchLayout, regionId: WorkbenchRegion, openInput: OpenWidgetInput) => {
  const region = layout.regions[regionId];
  const activeWidgetId = openInput.role === "location" ? layout.activeLocationWidgetId : region.activeWidgetId;

  if (openInput.replaceWidgetId) {
    return region.widgets.findIndex((placement) => placement.widgetId === openInput.replaceWidgetId);
  }
  if (openInput.tabRetention === "preview") {
    return region.widgets.findIndex((placement) => placement.tabRetention === "preview");
  }
  if (!openInput.replaceActive) return -1;
  const replacementWidgetId =
    regionId === "main" && openInput.resource && layout.activeLocationWidgetId
      ? layout.activeLocationWidgetId
      : activeWidgetId;
  return region.widgets.findIndex((placement) => placement.widgetId === replacementWidgetId && !placement.pinned);
};

const defaultTabPosition = (
  widgets: WorkbenchWidgetPlacement[],
  widget: RegisteredWidgetContribution,
  requireWidget: (id: string) => RegisteredWidgetContribution,
) => {
  const before = widgets.find((placement) => {
    try {
      return widget.priority > requireWidget(placement.contributionId).priority;
    } catch {
      return widget.priority > 0;
    }
  });
  return before ? ({ beforeWidgetId: before.widgetId } as const) : undefined;
};

export const createWidgetOpeners = (input: CreateWidgetOpenersInput) => {
  const { getLayout, requireWidget, applyAndActivate } = input;

  const bindToActiveLocation = (placement: WorkbenchWidgetPlacement, layout: WorkbenchLayout) => {
    if (placement.role !== "sub-panel" && placement.role !== "panel-menu") return placement;
    return { ...placement, ownerResourceUri: getActiveLocationPlacement(layout)?.resourceUri };
  };

  const updateSingleton = (
    widget: RegisteredWidgetContribution,
    existing: NonNullable<ReturnType<typeof findPlacement>>,
    openInput: OpenWidgetInput,
  ) => {
    const nextPlacement = bindToActiveLocation(
      buildUpdatedPlacement(existing.placement, widget, openInput),
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
    const nextPlacement = bindToActiveLocation(buildUpdatedPlacement(replacement, widget, openInput), getLayout());
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
    const placement = bindToActiveLocation(createPlacement(widgetId, widget, openInput), getLayout());
    const layout = replaceRegionWidgets(getLayout(), regionId, (widgets) => {
      if (replacementIndex < 0) {
        return placeWidget(
          widgets,
          placement,
          openInput.tabPosition ?? defaultTabPosition(widgets, widget, requireWidget),
        );
      }
      const copy = [...widgets];
      copy.splice(replacementIndex, 1, placement);
      return placement.tabRetention === "preview" ? placeWidget(copy, placement, "start") : copy;
    });
    return applyAndActivate(layout, regionId, placement);
  };

  const openWidget = (id: string, openInput: OpenWidgetInput = {}): WorkbenchWidgetPlacement => {
    const widget = requireWidget(id);
    const placementInput = withPlacementRole(widget, openInput);
    const layout = getLayout();
    const regionId = placementInput.region ?? widget.region ?? widget.fallbackRegion ?? "main";
    const region = layout.regions[regionId];
    const replacementIndex = findReplacementIndex(layout, regionId, placementInput);
    const replacement = replacementIndex >= 0 ? region.widgets[replacementIndex] : undefined;
    const previewContent =
      !placementInput.replaceWidgetId && placementInput.tabRetention === "preview" && placementInput.resource
        ? findResourcePlacement(layout, widget.id, placementInput.resource.uri)
        : undefined;
    const existing =
      placementInput.replaceWidgetId && replacement ? undefined : findReusablePlacement(widget, layout, placementInput);

    let placement: WorkbenchWidgetPlacement;
    if (previewContent) {
      placement = applyAndActivate(layout, previewContent.regionId, previewContent.placement);
    } else if (existing) {
      placement = reuseExistingPlacement(widget, existing, regionId, replacementIndex, placementInput);
    } else if (replacement?.contributionId === widget.id) {
      placement = replaceActive(widget, regionId, replacementIndex, replacement, placementInput);
    } else {
      placement = insertWidget(widget, regionId, replacementIndex, placementInput);
    }

    openOwnedPanelMenus({ openWidget, placement, requireWidget, widget });
    return applyAndActivate(getLayout(), previewContent?.regionId ?? regionId, placement);
  };

  return { openWidget };
};
