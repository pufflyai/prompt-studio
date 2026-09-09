import type { RendererEventReference } from "pstdio-api-contracts/extension-kernel";
import { resolveEventReferenceId } from "./event-reference";
import type { GuestHost } from "./guest-host";

export const EXTENSION_EVENTS_SCOPE = "extension.events";

export type WebviewExtensionEvent = { type: "changed"; id: string } | { type: "reset" };

export interface WebviewEventsClient {
  /** Refetch on a matching event or host sync reconnect. Returns the unsubscribe function. */
  subscribe(event: RendererEventReference, listener: () => void): () => void;
}

export const createWebviewEventsClient = (host: GuestHost, extensionId: string) => ({
  subscribe(event: RendererEventReference, listener: () => void) {
    const id = resolveEventReferenceId(event, extensionId);
    return host.onEvent(EXTENSION_EVENTS_SCOPE, (payload) => {
      const notification = payload as WebviewExtensionEvent;
      if (notification.type === "reset" || (notification.type === "changed" && notification.id === id)) listener();
    });
  },
});
