import type { PageLocation } from "@pstdio/sdk/extensions";
import {
  rendererReadKey,
  type WorkbenchCore,
  type WorkbenchPanelInstance,
  type WorkbenchPanelRenderInput,
} from "@pstdio/workbench";
import {
  resolveDashboardSessionViewForPlacement,
  resolveDashboardSessionViewForResource,
} from "../data/dashboard-sessions";

export interface SessionViewContext {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRenderInput["panel"]["region"];
  owner:
    | { kind: "panel"; instance: WorkbenchPanelInstance }
    | { kind: "page"; projectId: string; location: PageLocation };
}

export const sessionPanelContext = (input: WorkbenchPanelRenderInput): SessionViewContext => ({
  workbench: input.workbench,
  region: input.panel.region,
  owner: { kind: "panel", instance: input.instance },
});

const currentPagePlaceholder = (input: SessionViewContext) => {
  if (input.owner.kind !== "page") return false;
  const state = input.workbench.pages.store.getState();
  const current = state.location;
  const original = input.owner.location;
  return (
    state.projectId === input.owner.projectId &&
    current?.page.id === original.page.id &&
    current.page.extensionId === original.page.extensionId &&
    (current.resource ? input.workbench.pages.resourceReferenceKey(current.resource) : undefined) ===
      (original.resource ? input.workbench.pages.resourceReferenceKey(original.resource) : undefined) &&
    input.workbench.layout.getLayout().regions.main.widgets.length === 0
  );
};

export const sessionViewIsOpen = (input: SessionViewContext) =>
  input.owner.kind === "page"
    ? currentPagePlaceholder(input)
    : input.workbench.host.getOpenPlacementIds().has(input.owner.instance.instanceId);

export const sessionViewShowsDraft = (input: SessionViewContext, draftKey: string) => {
  if (input.owner.kind === "page") {
    const resource = input.owner.location.resource;
    return (
      currentPagePlaceholder(input) &&
      resolveDashboardSessionViewForResource(resource?.type === "session-draft" ? resource : undefined).draftKey ===
        draftKey
    );
  }
  const instanceId = input.owner.instance.instanceId;
  const placement = Object.values(input.workbench.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .find((widget) => widget.widgetId === instanceId);
  return Boolean(placement && resolveDashboardSessionViewForPlacement(placement).draftKey === draftKey);
};

export const sessionViewReadKey = (input: SessionViewContext) =>
  input.owner.kind === "panel"
    ? rendererReadKey(input.owner.instance, "session")
    : JSON.stringify(["page", input.owner.projectId, input.owner.location]);
