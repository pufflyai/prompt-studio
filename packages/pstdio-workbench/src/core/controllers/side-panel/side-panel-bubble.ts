import { getActiveLocationPlacement } from "../../registries/layout/layout-operations";
import type { WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { isWorkbenchPanelPlacementVisible } from "../../registries/layout/panel-widget-eligibility";
import type { PreferenceRegistry } from "../../registries/preferences/preference-registry";
import type { WorkbenchCore } from "../../workbench-core-types";
import { openPanelWidget } from "../composition/panel-widget-open";

export const sidePanelBubblePreferences = {
  visible: "workbench.sidePanelBubble.visible",
  alignment: "workbench.sidePanelBubble.alignment",
  panel: "workbench.sidePanelBubble.defaultPanel",
} as const;

export const registerSidePanelBubblePreferences = (preferences: PreferenceRegistry) =>
  preferences.registerSchema({
    properties: {
      [sidePanelBubblePreferences.visible]: { type: "boolean", scope: "user", default: true },
      [sidePanelBubblePreferences.alignment]: {
        type: "string",
        scope: "user",
        default: "right",
        enum: ["left", "center", "right"],
      },
      [sidePanelBubblePreferences.panel]: { type: "string", scope: "user", default: "default" },
    },
  });

const sidePanelChoices = (workbench: WorkbenchCore) => {
  const panels = workbench.composition.panelsFor("side");
  const layout = workbench.layout.getLayout();
  const isVisible = (placement: WorkbenchWidgetPlacement, region: WorkbenchPanelRegion) => {
    const widget = workbench.layout.getWidget(placement.contributionId);
    return (
      widget &&
      isWorkbenchPanelPlacementVisible(
        widget,
        workbench.getPrimaryResource(),
        workbench.modes.getActiveModeId(),
        placement,
        {
          ignoreResourceLocation: region === "side" || region === "secondary",
          location: getActiveLocationPlacement(layout),
        },
      )
    );
  };
  const open = panels.open.filter((placement) => isVisible(placement, "side"));
  const movable = (["main", "secondary"] as const).flatMap((region) =>
    layout.regions[region].widgets.filter(
      (placement) =>
        workbench.layout.getWidget(placement.contributionId)?.singleton &&
        workbench.getPanelDestinations(placement.widgetId).includes("side") &&
        isVisible(placement, region),
    ),
  );
  return { ...panels, open, movable };
};

export const getSidePanelBubblePanels = (workbench: WorkbenchCore) => {
  const { open, addable, movable } = sidePanelChoices(workbench);
  const choices = new Map(
    addable.map(({ panelId, contribution }) => [panelId, { id: panelId, title: contribution.title }]),
  );
  for (const placement of [...open, ...movable]) {
    const widget = workbench.layout.getWidget(placement.contributionId)!;
    if (!choices.has(widget.id)) choices.set(widget.id, { id: widget.id, title: widget.title });
  }
  return [...choices.values()];
};

export const openSidePanelBubble = async (workbench: WorkbenchCore, openDefault?: () => void | Promise<void>) => {
  const selected = workbench.preferences.getValue(sidePanelBubblePreferences.panel);
  if (selected === "default" && openDefault) {
    await openDefault();
    return;
  }
  if (typeof selected === "string" && selected.startsWith("panel:")) {
    const id = selected.slice("panel:".length);
    const { open, addable, movable } = sidePanelChoices(workbench);
    const widget = workbench.layout.getWidget(id);
    const rendererId = widget?.rendererId;
    const matches = (panel: WorkbenchWidgetPlacement) =>
      panel.contributionId === id && (panel.viewId ?? rendererId) === rendererId;
    const activeId = workbench.layout.getLayout().regions.side.activeWidgetId;
    const existing = open.find((panel) => matches(panel) && panel.widgetId === activeId) ?? open.find(matches);
    const elsewhere = movable.find(matches);
    const singleton = widget?.singleton
      ? [...open, ...movable].find((panel) => panel.contributionId === id)
      : undefined;
    const target = existing ?? elsewhere ?? singleton;
    if (target) {
      if (!open.includes(target)) workbench.movePanel(target.widgetId, "side");
      if (!matches(target)) workbench.layout.updatePanel(target.widgetId, { viewId: null });
      workbench.layout.activatePanel(target.widgetId);
    } else {
      const panel = addable.find((panel) => panel.panelId === id);
      if (panel)
        await openPanelWidget({
          workbench,
          widget: panel.contribution,
          region: "side",
          resource: workbench.getPrimaryResource(),
          pinned: panel.pinned,
          open: panel.open,
        });
    }
  }
  workbench.shell.setSidePanelPresentation("floating");
};
