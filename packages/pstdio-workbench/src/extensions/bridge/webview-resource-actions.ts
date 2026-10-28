import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WebviewHostCapabilityParams } from "pstdio-api-contracts/extension-kernel";
import { RESOURCE_ACTIONS_EVENTS_SCOPE } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchCore } from "../../core";
import { orderMenuEntries, resolveMenuEntries } from "../../react/menus/menu-entries";
import { resolveResourceActionMenu, subscribeResourceActionChanges } from "../../react/menus/resource-action-menu";

// Tells a frame to list again once actions may have changed. The subscription
// starts on the first list and ends when the frame disconnects.
const createChangeNotifier = (workbench: WorkbenchCore, hostEvents: HostEventPublisher | undefined) => {
  let stop: (() => void) | undefined;
  let pending = false;
  const emit = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      hostEvents?.emit({ scope: RESOURCE_ACTIONS_EVENTS_SCOPE, payload: { type: "changed" } });
    });
  };
  return () => {
    if (!hostEvents || stop) return;
    const unsubscribe = subscribeResourceActionChanges(workbench, emit);
    const stopOnDisconnect = hostEvents.onDisconnect(() => stop?.());
    stop = () => {
      unsubscribe();
      stopOnDisconnect();
      stop = undefined;
    };
  };
};

export const createWebviewResourceActions = (
  workbench: WorkbenchCore,
  projectId: string | undefined,
  hostEvents: HostEventPublisher | undefined,
  placement?: PlacementIdentity,
) => {
  const watchChanges = createChangeNotifier(workbench, hostEvents);
  return async (input: WebviewHostCapabilityParams["resources.actions"]) => {
    // The host owns the project scope; webviews cannot reach another project's resources.
    const menu = resolveResourceActionMenu(workbench, projectId ? { ...input.resource, projectId } : input.resource);
    const entries = menu
      ? orderMenuEntries(resolveMenuEntries({ ...menu, context: { ...menu.context, placement, projectId } }))
      : [];
    if (input.operation === "execute") {
      const entry = entries.find(({ id }) => id === input.key);
      if (!entry?.run || entry.disabled) throw new Error("This resource action is no longer available.");
      await entry.run();
      return [];
    }
    watchChanges();
    return entries.map((entry) => ({
      key: entry.id,
      label: entry.label,
      commandId: entry.commandId,
      icon: entry.icon,
      iconSrc: entry.iconSrc,
      description: entry.description,
      isDisabled: entry.disabled,
      separatorBefore: entry.separatorBefore,
      group: entry.group ?? menu?.group,
    }));
  };
};
