import type { WorkbenchCore } from "../../workbench-core-types";
import { openPanelWidget } from "../composition/panel-widget-open";

export const selectKeyboardTab = async (core: WorkbenchCore, number: number) => {
  const target = core.keyboard.listNumberedTargets().find((target) => target.number === number);
  if (!target) {
    core.keyboard.message(`Tab ${number} is not available.`);
    return;
  }
  if (target.kind === "tab") {
    core.keyboard.selectPresentation(target.tab.id, target.tab.resource?.id);
    return;
  }
  const panel = core.composition
    .panelsFor(target.region)
    .addable.find((panel) => panel.panelId === target.panel.panelId);
  if (!panel) {
    core.keyboard.message("This panel is no longer available.");
    return;
  }
  const keepMode = core.keyboard.store.getState().active;
  core.keyboard.close(false);
  await openPanelWidget({
    workbench: core,
    widget: panel.contribution,
    region: target.region,
    resource: core.getPrimaryResource(),
    open: panel.open,
    pinned: panel.pinned,
  });
  const opened = core.keyboard
    .visibleTargets()
    .find((tab) => tab.region === target.region && tab.id === core.layout.getLayout().activeWidgetId);
  if (keepMode && opened) {
    core.keyboard.open();
    core.keyboard.selectPresentation(opened.id, opened.resource?.id);
  }
};
