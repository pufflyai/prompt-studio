import {
  buildUpdatedPlacement,
  createPlacement,
  findPlacement,
  findResourcePlacement,
  replaceAreaWidgets,
} from "./layout-operations";
import type {
  OpenWidgetInput,
  RegisteredWidgetContribution,
  SlotId,
  WorkbenchLayout,
  WorkbenchWidgetPlacement,
} from "./layout-types";

interface CreateWidgetOpenersInput {
  getLayout(): WorkbenchLayout;
  requireArea(areaId: SlotId): WorkbenchLayout["areas"][SlotId];
  requireWidget(id: string): RegisteredWidgetContribution;
  applyAndActivate(
    layout: WorkbenchLayout,
    areaId: SlotId,
    placement: WorkbenchWidgetPlacement,
  ): WorkbenchWidgetPlacement;
  applyWithoutActivation(layout: WorkbenchLayout, placement: WorkbenchWidgetPlacement): WorkbenchWidgetPlacement;
}

const findReusablePlacement = (
  widget: RegisteredWidgetContribution,
  layout: WorkbenchLayout,
  openInput: OpenWidgetInput,
) => {
  if (widget.singleton) return findPlacement(layout, widget.id);
  if (widget.reuse === "none") return undefined;
  if (openInput.resource) return findResourcePlacement(layout, widget.id, openInput.resource.uri);
  return findPlacement(layout, widget.id);
};

export const createWidgetOpeners = (input: CreateWidgetOpenersInput) => {
  const { getLayout, requireArea, requireWidget, applyAndActivate, applyWithoutActivation } = input;
  let placementCounter = 0;

  const applyPlacement = (
    widget: RegisteredWidgetContribution,
    layout: WorkbenchLayout,
    areaId: SlotId,
    placement: WorkbenchWidgetPlacement,
  ) => (widget.menu ? applyWithoutActivation(layout, placement) : applyAndActivate(layout, areaId, placement));

  const updateSingleton = (
    widget: RegisteredWidgetContribution,
    existing: NonNullable<ReturnType<typeof findPlacement>>,
    openInput: OpenWidgetInput,
  ) => {
    const nextPlacement = buildUpdatedPlacement(existing.placement, widget, openInput);
    const layout = replaceAreaWidgets(getLayout(), existing.areaId, (widgets) =>
      widgets.map((current, index) => (index === existing.index ? nextPlacement : current)),
    );
    return applyPlacement(widget, layout, existing.areaId, nextPlacement);
  };

  const replaceActive = (
    widget: RegisteredWidgetContribution,
    areaId: SlotId,
    replacementIndex: number,
    replacement: WorkbenchWidgetPlacement,
    openInput: OpenWidgetInput,
  ) => {
    const nextPlacement = buildUpdatedPlacement(replacement, widget, openInput);
    const layout = replaceAreaWidgets(getLayout(), areaId, (widgets) =>
      widgets.map((current, index) => (index === replacementIndex ? nextPlacement : current)),
    );
    return applyPlacement(widget, layout, areaId, nextPlacement);
  };

  const reuseExistingPlacement = (
    widget: RegisteredWidgetContribution,
    existing: NonNullable<ReturnType<typeof findPlacement>>,
    areaId: SlotId,
    replacementIndex: number,
    openInput: OpenWidgetInput,
  ) => {
    if (existing.areaId !== areaId) {
      const nextPlacement = buildUpdatedPlacement(existing.placement, widget, openInput);
      const withoutExisting = replaceAreaWidgets(
        getLayout(),
        existing.areaId,
        (widgets) => widgets.filter((_current, index) => index !== existing.index),
        { clearActiveWidget: requireArea(existing.areaId).activeWidgetId === existing.placement.widgetId },
      );
      const layout = replaceAreaWidgets(withoutExisting, areaId, (widgets) => {
        if (replacementIndex < 0) return [...widgets, nextPlacement];
        const copy = [...widgets];
        copy.splice(replacementIndex, 1, nextPlacement);
        return copy;
      });
      return applyPlacement(widget, layout, areaId, nextPlacement);
    }

    if (replacementIndex < 0 || existing.index === replacementIndex) {
      return updateSingleton(widget, existing, openInput);
    }

    const nextPlacement = buildUpdatedPlacement(existing.placement, widget, openInput);
    const layout = replaceAreaWidgets(getLayout(), areaId, (widgets) =>
      widgets
        .map((current, index) => (index === existing.index ? nextPlacement : current))
        .filter((_current, index) => index !== replacementIndex),
    );
    return applyPlacement(widget, layout, areaId, nextPlacement);
  };

  const insertWidget = (
    widget: RegisteredWidgetContribution,
    areaId: SlotId,
    replacementIndex: number,
    openInput: OpenWidgetInput,
  ) => {
    const area = requireArea(areaId);
    const hasPlacement = area.widgets.some(
      (placement, index) => index !== replacementIndex && placement.widgetId === widget.id,
    );
    if (hasPlacement) placementCounter += 1;
    const widgetId = hasPlacement ? `${widget.id}:${placementCounter}` : widget.id;
    const placement = createPlacement(widgetId, widget, openInput);

    const layout = replaceAreaWidgets(getLayout(), areaId, (widgets) => {
      if (replacementIndex >= 0) {
        const copy = [...widgets];
        copy.splice(replacementIndex, 1, placement);
        return copy;
      }
      return [...widgets, placement];
    });
    return applyPlacement(widget, layout, areaId, placement);
  };

  const openWidget = (id: string, openInput: OpenWidgetInput = {}) => {
    const widget = requireWidget(id);
    const layout = getLayout();
    const areaId = openInput.area ?? widget.area ?? widget.fallbackArea ?? "main";
    const area = requireArea(areaId);
    const replacementIndex =
      openInput.replaceActive && !widget.menu
        ? area.widgets.findIndex((placement) => placement.widgetId === area.activeWidgetId && !placement.pinned)
        : -1;
    const replacement = replacementIndex >= 0 ? area.widgets[replacementIndex] : undefined;

    const existing = findReusablePlacement(widget, layout, openInput);
    if (existing) return reuseExistingPlacement(widget, existing, areaId, replacementIndex, openInput);

    if (replacement?.contributionId === widget.id) {
      return replaceActive(widget, areaId, replacementIndex, replacement, openInput);
    }

    return insertWidget(widget, areaId, replacementIndex, openInput);
  };

  return { openWidget };
};
