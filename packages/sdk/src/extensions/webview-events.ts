import type { RendererEventReference } from "pstdio-api-contracts/extension-kernel";
import { EXTENSION_EVENTS_SCOPE as hostExtensionEventsScope } from "pstdio-api-contracts/extension-kernel";
import { resolveEventReferenceId } from "./event-reference";
import type { GuestHost } from "./guest-host";
import type { QueryChangeEnvelope } from "./query-dependency";

/** @deprecated Host-only. Hosts import `EXTENSION_EVENTS_SCOPE` from `pstdio-api-contracts`. */
export const EXTENSION_EVENTS_SCOPE = hostExtensionEventsScope;

export type WebviewExtensionEvent =
  | ({ type: "changed"; id: string } & QueryChangeEnvelope)
  | ({ type: "reset" } & QueryChangeEnvelope);

export interface WebviewEventsClient {
  /** Refetch on a matching event or host sync reconnect. Returns the unsubscribe function. */
  subscribe(event: RendererEventReference, listener: (event?: WebviewExtensionEvent) => void): () => void;
}

export const createWebviewEventsClient = (host: GuestHost, extensionId: string) => ({
  subscribe(event: RendererEventReference, listener: (event?: WebviewExtensionEvent) => void) {
    const id = resolveEventReferenceId(event, extensionId);
    const sourceExtensionId = typeof event === "object" ? (event.extensionId ?? extensionId) : undefined;
    return host.onEvent(EXTENSION_EVENTS_SCOPE, (payload) => {
      const notification = payload as WebviewExtensionEvent;
      if (
        notification.type === "reset" &&
        notification.extensionId &&
        sourceExtensionId &&
        notification.extensionId !== sourceExtensionId
      )
        return;
      if (notification.type === "reset" || (notification.type === "changed" && notification.id === id))
        listener(notification);
    });
  },
});
