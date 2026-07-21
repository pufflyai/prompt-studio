import type { RegisteredWidgetContribution, ResourceRef, WorkbenchCore, WorkbenchPanelRegion } from "../../core";

interface OpenPanelWidgetInput {
  workbench: WorkbenchCore;
  widget: RegisteredWidgetContribution;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
}

export const getPanelLabel = (region: WorkbenchPanelRegion) => {
  if (region === "secondary") return "Secondary";
  if (region === "side") return "Side";
  return "Main";
};

export const openPanelWidget = (input: OpenPanelWidgetInput) => {
  const { region, resource, widget, workbench } = input;

  if (widget.openCommandId) {
    void workbench.commands.executeCommand(widget.openCommandId, undefined, resource ? { resource } : undefined);
  } else {
    const widgetResource = widget.resourceKinds?.length || widget.canOpen ? resource : undefined;
    workbench.layout.openWidget(widget.id, { region, resource: widgetResource, closable: true });
  }

  if (region === "secondary") {
    workbench.panels.setOpen("secondary", true);
    workbench.layout.setRegionVisible("secondary", true);
  }
  if (region === "side") workbench.sessionPanel.setMode("attached");
};
