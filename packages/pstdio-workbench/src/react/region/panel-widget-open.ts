import type { RegisteredWidgetContribution, ResourceRef, WorkbenchCore, WorkbenchPanelRegion } from "../../core";

interface OpenPanelWidgetInput {
  workbench: WorkbenchCore;
  widget: RegisteredWidgetContribution;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
  pinned?: boolean;
}

export const getPanelLabel = (region: WorkbenchPanelRegion) => {
  if (region === "secondary") return "Secondary";
  if (region === "side") return "Side";
  return "Main";
};

export const openPanelWidget = (input: OpenPanelWidgetInput) => {
  const { pinned, region, resource, widget, workbench } = input;

  if (widget.openCommandId) {
    void workbench.commands.executeCommand(widget.openCommandId, undefined, {
      source: "panel-add",
      ...(resource ? { resource } : {}),
    });
  } else {
    const widgetResource = widget.resourceKinds?.length || widget.canOpen ? resource : undefined;
    // Adding a tab from the region's "+" tray is the user asking for a tab that stays.
    // The resource only binds the tab to its location; the tab is the widget, so it
    // keeps the widget's title instead of inheriting the location resource's label.
    workbench.layout.openWidget(widget.id, {
      region,
      resource: widgetResource,
      title: widget.title,
      closable: true,
      pinned,
      role: region === "main" ? "location" : "sub-panel",
      tabRetention: "persistent",
    });
  }

  if (region === "secondary") {
    workbench.panels.setOpen("secondary", true);
    workbench.layout.setRegionVisible("secondary", true);
  }
  if (region === "side" && workbench.sidePanel.getMode() === "closed") {
    workbench.sidePanel.setMode("attached");
  }
};
