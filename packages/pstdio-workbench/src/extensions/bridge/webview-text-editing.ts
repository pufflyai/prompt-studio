import type { TextEditingTransportClient } from "@pstdio/sdk/client";
import type { NativeDocumentTarget } from "pstdio-api-contracts";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchCore, WorkbenchPanelInstance } from "../../core";
import { requestPlacementText } from "../../core/text-editing/placement-text-guests";
import type { ExtensionWebviewHostAdapters } from "./extension-webview-host-adapters";

export interface WorkbenchTextEditingInput {
  workbench: WorkbenchCore;
  placement?: WorkbenchPanelInstance;
  projectId?: string;
  webviewId?: string;
  textTarget?: NativeDocumentTarget;
  textEditing?: TextEditingTransportClient;
  hostEvents?: HostEventPublisher;
  prepareSessionClose?: () => Promise<void>;
}

export const createWorkbenchTextEditingAdapter = (input: WorkbenchTextEditingInput) => {
  const { workbench, placement, projectId, webviewId, textTarget, textEditing, hostEvents } = input;
  if (!placement || !projectId || !textEditing || !hostEvents || (!webviewId && !textTarget)) return undefined;
  const invocation = workbench.viewers.captureContext(placement.placementIdentity);
  const assertCurrent = () => {
    if (workbench.pages.store.getState().projectId !== projectId || invocation.isViewerCurrent?.() === false)
      throw Object.assign(new Error("This text view is no longer open"), { code: "session_closed", retryable: false });
  };
  const request: NonNullable<ExtensionWebviewHostAdapters["textEditing"]>["request"] = async (request) => {
    assertCurrent();
    const target = textTarget && {
      ...textTarget,
      pageParams:
        textTarget.pageParams &&
        Object.fromEntries(
          Object.entries(textTarget.pageParams).map(([key, value]) => [
            key,
            typeof value === "object" ? [...value] : value,
          ]),
        ),
    };
    return requestPlacementText(
      {
        workbench,
        placement,
        projectId,
        scope: { kind: "placement", viewId: webviewId, target },
        transport: textEditing,
        events: hostEvents,
        prepareSessionClose: input.prepareSessionClose,
      },
      request,
    );
  };
  return { request } satisfies ExtensionWebviewHostAdapters["textEditing"];
};
