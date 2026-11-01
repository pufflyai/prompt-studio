import type { GuestHost, ResourceRef, WebviewResourceAction } from "@pstdio/sdk/extensions";

interface TicketCardActionsHandlers {
  onActions: (actions: WebviewResourceAction[]) => void;
  onError?: (reason: unknown) => void;
}

// Listing a resource's actions resolves its whole context menu in the workbench, and the host
// reports a change whenever anything that could affect any menu changes. A timeline draws many
// cards, so cards list only when someone is about to use one; a change marks the list stale.
export const createTicketCardActions = (
  host: Pick<GuestHost, "call" | "onEvent">,
  handlers: TicketCardActionsHandlers,
) => {
  let listed: string | undefined;
  let active = true;
  const stop = host.onEvent("resources.actions", () => {
    listed = undefined;
  });
  return {
    prepare(resource: ResourceRef) {
      const key = JSON.stringify(resource);
      if (listed === key) return;
      listed = key;
      host
        .call("resources.actions", { operation: "list", resource })
        .then((actions) => {
          if (active && listed === key) handlers.onActions(actions);
        })
        .catch((reason) => {
          if (listed === key) listed = undefined;
          if (active) handlers.onError?.(reason);
        });
    },
    dispose() {
      active = false;
      stop();
    },
  };
};
