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
  ensureArea(areaId: SlotId): WorkbenchLayout["areas"][SlotId];
  isAreaActive(areaId: SlotId): boolean;
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

const allocatePlacementId = (layout: WorkbenchLayout, contributionId: string) => {
  const placements = [...Object.values(layout.areas), ...Object.values(layout.orphans ?? {})].flatMap(
    (area) => area.widgets,
  );
  if (!placements.some((placement) => placement.widgetId === contributionId)) return contributionId;

  const prefix = `${contributionId}:`;
  const suffixes = placements
    .map((placement) => placement.widgetId)
    .filter((widgetId) => widgetId.startsWith(prefix))
    .map((widgetId) => Number(widgetId.slice(prefix.length)))
    .filter(Number.isInteger);
  return `${contributionId}:${Math.max(0, ...suffixes) + 1}`;
};

export const createWidgetOpeners = (input: CreateWidgetOpenersInput) => {
  const { getLayout, ensureArea, isAreaActive, requireWidget, applyAndActivate, applyWithoutActivation } = input;

  const applyPlacement = (
    widget: RegisteredWidgetContribution,
    layout: WorkbenchLayout,
    areaId: SlotId,
    placement: WorkbenchWidgetPlacement,
  ) =>
    widget.menu || !isAreaActive(areaId)
      ? applyWithoutActivation(layout, placement)
      : applyAndActivate(layout, areaId, placement);

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
        { clearActiveWidget: ensureArea(existing.areaId).activeWidgetId === existing.placement.widgetId },
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
    const widgetId = allocatePlacementId(getLayout(), widget.id);
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
    const areaId = openInput.area ?? widget.area;
    const area = ensureArea(areaId);
    const layout = getLayout();
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
