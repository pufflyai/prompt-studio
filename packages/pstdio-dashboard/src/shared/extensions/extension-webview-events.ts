import type { WebviewExtensionEvent } from "@pstdio/sdk/extensions";
import { EXTENSION_EVENTS_SCOPE } from "pstdio-api-contracts";
import { canonicalExtensionId, historicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import { subscribeToExtensionEventFeed, subscribeToExtensionEventReset } from "./extension-webview-broadcast";

export const subscribeWebviewExtensionEvents = (host: HostEventPublisher, projectId: string | undefined) => {
  const emit = (payload: WebviewExtensionEvent) => host.emit({ scope: EXTENSION_EVENTS_SCOPE, payload });
  const stopEvents = subscribeToExtensionEventFeed((event) => {
    if (event.projectId === projectId) emit({ type: "changed", ...event });
  });
  const stopReset = subscribeToExtensionEventReset((reset) => {
    if (reset.projectId === undefined || reset.projectId === projectId) {
      const { extensionId, ...scope } = reset;
      // One project-scoped reset reaches both historical and current typed guest filters.
      const renamed =
        extensionId && historicalExtensionId(canonicalExtensionId(extensionId)) !== canonicalExtensionId(extensionId);
      emit({ type: "reset", ...scope, ...(!renamed && extensionId ? { extensionId } : {}) });
    }
  });
  return () => {
    stopEvents();
    stopReset();
  };
};
