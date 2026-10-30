import type { WebviewExtensionEvent } from "@pstdio/sdk/extensions";
import { EXTENSION_EVENTS_SCOPE } from "pstdio-api-contracts";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import { subscribeToExtensionEventFeed, subscribeToExtensionEventReset } from "./extension-webview-broadcast";

export const subscribeWebviewExtensionEvents = (host: HostEventPublisher, projectId: string | undefined) => {
  const emit = (payload: WebviewExtensionEvent) => host.emit({ scope: EXTENSION_EVENTS_SCOPE, payload });
  const stopEvents = subscribeToExtensionEventFeed((event) => {
    if (event.projectId === projectId) emit({ type: "changed", id: event.id });
  });
  const stopReset = subscribeToExtensionEventReset((reset) => {
    if (reset.projectId === undefined || reset.projectId === projectId) emit({ type: "reset" });
  });
  return () => {
    stopEvents();
    stopReset();
  };
};
