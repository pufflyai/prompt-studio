import type {
  RegisteredWidgetContribution,
  ResourceRef,
  WorkbenchCompositionAddablePanel,
  WorkbenchCore,
  WorkbenchPanelRegion,
} from "../../core";
import { runUserAction } from "../../core/shared/run-user-action";

interface OpenPanelWidgetInput {
  workbench: WorkbenchCore;
  widget: RegisteredWidgetContribution;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
  pinned?: boolean;
  open?: WorkbenchCompositionAddablePanel["open"];
}

export const getPanelLabel = (region: WorkbenchPanelRegion) => {
  if (region === "secondary") return "Secondary";
  if (region === "side") return "Side";
  return "Main";
};

export const openPanelWidget = async (input: OpenPanelWidgetInput) => {
  const { open, pinned, region, resource, widget, workbench } = input;

  if (open) {
    await open(resource);
  } else if (widget.openCommand) {
    await runUserAction(workbench, widget.title, async () => {
      await workbench.commands.executeCommand(widget.openCommand!.commandId, widget.openCommand!.args, {
        source: "panel-add",
        region,
        ...(resource ? { resource } : {}),
      });
    });
  } else {
    // Adding a tab from the region's "+" tray is the user asking for a tab that stays.
    workbench.layout.openWidget(widget.id, {
      region,
      title: widget.title,
      closable: true,
      pinned,
      role: region === "main" ? "location" : "sub-panel",
      tabRetention: "persistent",
    });
  }

  if (region === "secondary") {
    workbench.shell.setRegionOpen("secondary", true);
  }
  if (region === "side" && workbench.sidePanel.getMode() === "closed") {
    workbench.sidePanel.setMode("attached");
  }
};
