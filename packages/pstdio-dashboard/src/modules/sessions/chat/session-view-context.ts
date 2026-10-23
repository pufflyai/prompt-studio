import {
  rendererReadKey,
  type WorkbenchCore,
  type WorkbenchPanelInstance,
  type WorkbenchPanelRenderInput,
} from "@pstdio/workbench";
import { resolveDashboardSessionViewForPlacement } from "../data/dashboard-sessions";

export interface SessionViewContext {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRenderInput["panel"]["region"];
  instance: WorkbenchPanelInstance;
}

export const sessionPanelContext = (input: WorkbenchPanelRenderInput): SessionViewContext => ({
  workbench: input.workbench,
  region: input.panel.region,
  instance: input.instance,
});

export const sessionViewIsOpen = (input: SessionViewContext) =>
  input.workbench.host.getOpenPlacementIds().has(input.instance.instanceId);

export const sessionViewPlacement = (input: SessionViewContext) =>
  (["main", "side", "secondary"] as const)
    .flatMap((region) => input.workbench.layout.listPanelInstances(region).map((instance) => ({ region, instance })))
    .find(({ instance }) => instance.instanceId === input.instance.instanceId);

export const sessionViewShowsDraft = (input: SessionViewContext, draftKey: string) => {
  const placement = sessionViewPlacement(input);
  return Boolean(placement && resolveDashboardSessionViewForPlacement(placement.instance).draftKey === draftKey);
};

export const sessionViewReadKey = (input: SessionViewContext) => rendererReadKey(input.instance, "session");
