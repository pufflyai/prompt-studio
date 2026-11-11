import type { ResourceRef, WebviewHostProps } from "@pstdio/sdk/extensions";
import type { WorkbenchCore, WorkbenchPanelInstance } from "@pstdio/workbench";
import { createExtensionSlot, createWebviewCommandQueryAdapter } from "@pstdio/workbench/extensions";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import type { RuntimeCollections } from "@/lib/sync/collections";
import { createDashboardCommandQueryReader } from "./webview-command-query-reader";

export const createDashboardWebviewCommandQueries = (input: {
  runtime: RuntimeCollections;
  queryScope: WebviewHostProps["queryScope"];
  projectId: string;
  extensionId: string;
  extensionInstanceId?: string;
  webviewId: string;
  source: readonly unknown[];
  slotKind?: "panel" | "settings";
  resource?: ResourceRef;
  workbench?: WorkbenchCore;
  placement?: WorkbenchPanelInstance;
  events: HostEventPublisher;
}) => {
  const { runtime, projectId, extensionId, webviewId, workbench, resource, queryScope } = input;
  const queries = getDashboardScopedQueries(runtime);
  const owner = JSON.stringify([
    queryScope,
    projectId,
    extensionId,
    input.extensionInstanceId,
    webviewId,
    input.slotKind,
    resource,
    input.source,
  ]);
  const captured = workbench?.viewers.captureContext(input.placement?.placementIdentity);
  const slot = createExtensionSlot({
    id: webviewId,
    kind: input.slotKind ?? "panel",
    projectId,
    context: { panelId: webviewId },
  });
  const reader = createDashboardCommandQueryReader({ runtime, projectId, queryScope, resource, workbench, slot });
  return createWebviewCommandQueryAdapter({
    queries,
    owner,
    projectId,
    extensionId,
    events: input.events,
    workbench,
    captureRead: reader.captureRead,
    requireCurrent() {
      reader.assertAuthority();
      if (
        workbench &&
        (workbench.pages.store.getState().projectId !== projectId || captured?.isViewerCurrent?.() === false)
      )
        throw new Error("The calling viewer is no longer open");
    },
  });
};
