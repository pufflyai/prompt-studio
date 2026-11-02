import type { GuestHost, ResourceRef, WebviewResourceAction } from "@pstdio/sdk/extensions";

interface TicketCardActionsHandlers {
  onActions: (actions: WebviewResourceAction[]) => void;
  onError?: (reason: unknown) => void;
}

// Listing a resource's actions resolves its whole context menu in the workbench, and the host
// reports a change whenever anything that could affect any menu changes. A timeline draws many
// cards, so a change only marks a card's list stale; the card lists again when someone uses it.
export const createTicketCardActions = (
  host: Pick<GuestHost, "call" | "onEvent">,
  handlers: TicketCardActionsHandlers,
) => {
  let listedKey: string | undefined;
  let stale = false;
  let latest = 0;
  let active = true;
  const stop = host.onEvent("resources.actions", () => {
    stale = true;
  });
  const list = (resource: ResourceRef, key: string) => {
    listedKey = key;
    stale = false;
    const request = ++latest;
    host
      .call("resources.actions", { operation: "list", resource })
      .then((actions) => {
        // A result that arrives after a change is still newer than what the card shows.
        if (active && request === latest) handlers.onActions(actions);
      })
      .catch((reason) => {
        if (request !== latest) return;
        stale = true;
        if (active) handlers.onError?.(reason);
      });
  };
  return {
    /** Lists once per resource, so touch and keyboard menus have actions before their first use. */
    load(resource: ResourceRef) {
      const key = JSON.stringify(resource);
      if (key !== listedKey) list(resource, key);
    },
    /** Lists again when a change arrived since the last list. */
    refresh(resource: ResourceRef) {
      const key = JSON.stringify(resource);
      if (key !== listedKey || stale) list(resource, key);
    },
    dispose() {
      active = false;
      stop();
    },
  };
};
