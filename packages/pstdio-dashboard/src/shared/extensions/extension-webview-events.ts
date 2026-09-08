import { EXTENSION_EVENTS_SCOPE, type WebviewExtensionEvent } from "@pstdio/sdk/extensions";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import { subscribeToExtensionEventFeed, subscribeToExtensionEventReset } from "./extension-webview-broadcast";

export const subscribeWebviewExtensionEvents = (host: HostEventPublisher, projectId: string | undefined) => {
  const emit = (payload: WebviewExtensionEvent) => host.emit({ scope: EXTENSION_EVENTS_SCOPE, payload });
  const stopEvents = subscribeToExtensionEventFeed((event) => {
    if (event.projectId === projectId) emit({ type: "changed", id: event.id });
  });
  const stopReset = subscribeToExtensionEventReset(() => emit({ type: "reset" }));
  return () => {
    stopEvents();
    stopReset();
  };
};
