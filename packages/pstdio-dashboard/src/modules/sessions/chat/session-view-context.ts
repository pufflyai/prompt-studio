import {
  rendererReadKey,
  type WorkbenchCore,
  type WorkbenchPanelInstance,
  type WorkbenchPanelRenderInput,
} from "@pstdio/workbench";

export interface SessionViewContext {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRenderInput["panel"]["region"];
  instance: WorkbenchPanelInstance;
  changeViewer: ReturnType<WorkbenchCore["viewers"]["capture"]>;
}

export const sessionPanelContext = (input: WorkbenchPanelRenderInput): SessionViewContext => ({
  workbench: input.workbench,
  region: input.panel.region,
  instance: input.instance,
  changeViewer: input.instance.placementIdentity
    ? input.workbench.viewers.capture(input.instance.placementIdentity)
    : undefined,
});

export const sessionViewIsOpen = (input: SessionViewContext) =>
  input.workbench.host.getOpenPlacementIds().has(input.instance.instanceId);

export const sessionViewReadKey = (input: SessionViewContext) => rendererReadKey(input.instance, "session");
