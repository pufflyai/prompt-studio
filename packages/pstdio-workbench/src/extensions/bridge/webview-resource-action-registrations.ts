import type { WebviewHostCapabilityParams } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { Disposable, WorkbenchCommandExecutionContext } from "../../core";
import { placementIdentityKey } from "../../core/registries/layout/placement-reconciliation";
import { resolveResourceActionMenu } from "../../react/menus/resource-action-menu";
import type { WorkbenchTextEditingInput } from "./webview-text-editing";

const scope = "resources.actions.invoke";
type Pending = { finish(error?: string): void; cancel(): void };
type Owner = { id: string; actions: Map<string, () => void>; pending: Map<string, Pending> };
const owners = new WeakMap<HostEventPublisher, Owner>();

// A live guest owns these actions. Disconnect drops the commands and pending work;
// nothing is buffered for an eventual replacement frame to execute.
const ownerFor = (events: HostEventPublisher) => {
  const existing = owners.get(events);
  if (existing) return existing;
  const owner: Owner = { id: crypto.randomUUID(), actions: new Map(), pending: new Map() };
  owners.set(events, owner);
  const stop = events.onDisconnect(() => {
    for (const pending of owner.pending.values()) pending.finish("The action's view disconnected.");
    for (const dispose of [...owner.actions.values()]) dispose();
    owners.delete(events);
    stop();
  });
  return owner;
};

export const createWebviewResourceActionRegistrations = (
  input: WorkbenchTextEditingInput & { extensionId?: string },
  assertCurrent: () => void,
) => {
  const { workbench, placement, projectId, extensionId, hostEvents } = input;
  const identity = placement?.placementIdentity;
  const resource = placement?.resource;
  if (!hostEvents || !identity || !resource || !extensionId || !projectId) return undefined;
  const key = workbench.pages.resourceReferenceKey(resource);
  const matches = (context?: WorkbenchCommandExecutionContext) => {
    try {
      assertCurrent();
      return (
        !!context?.placement &&
        !!context.resource &&
        placementIdentityKey(context.placement) === placementIdentityKey(identity) &&
        workbench.pages.resourceReferenceKey(context.resource) === key &&
        (!context.projectId || context.projectId === projectId)
      );
    } catch {
      return false;
    }
  };
  return async (request: WebviewHostCapabilityParams["resources.actions.register"]) => {
    if (request.operation === "complete") {
      owners.get(hostEvents)?.pending.get(request.requestId)?.finish(request.error);
      return;
    }
    if (request.operation === "unregister") {
      owners.get(hostEvents)?.actions.get(request.registrationId)?.();
      return;
    }
    assertCurrent();
    if (resource.extensionId !== extensionId || workbench.pages.resourceReferenceKey(request.resource) !== key)
      throw new Error("A view can register actions only for its own current extension resource.");
    const menu = resolveResourceActionMenu(workbench, resource);
    if (!menu) throw new Error("The resource is no longer available.");
    const owner = ownerFor(hostEvents);
    if (owner.actions.has(request.registrationId)) throw new Error("This resource action is already registered.");
    if (owner.actions.size >= 32) throw new Error("A view can register at most 32 resource actions.");
    const commandId = `webview.resource-action.${owner.id}.${request.registrationId}`;
    let active: string | undefined;
    const disposables: Disposable[] = [];
    const dispose = () => {
      if (active) owner.pending.get(active)?.cancel();
      owner.actions.delete(request.registrationId);
      for (const item of disposables.reverse()) item.dispose();
    };
    disposables.push(
      workbench.commands.registerCommand(
        { id: commandId, label: request.label },
        {
          isVisible: (_args, context) => matches(context),
          isEnabled: (_args, context) => matches(context) && !active,
          execute: (_args, context) => {
            if (!matches(context) || active) throw new Error("This resource action is no longer available.");
            const requestId = crypto.randomUUID();
            active = requestId;
            return new Promise<void>((resolve, reject) => {
              const finish = (error?: string) => {
                if (!owner.pending.delete(requestId)) return;
                active = undefined;
                context?.signal?.removeEventListener("abort", cancel);
                try {
                  assertCurrent();
                  if (error) throw new Error(error);
                  resolve();
                } catch (cause) {
                  reject(cause);
                }
              };
              const cancel = () => {
                hostEvents.emit({
                  scope,
                  payload: { type: "cancel", requestId, registrationId: request.registrationId },
                });
                finish("The resource action was cancelled.");
              };
              owner.pending.set(requestId, { finish, cancel });
              context?.signal?.addEventListener("abort", cancel, { once: true });
              if (context?.signal?.aborted) {
                cancel();
                return;
              }
              hostEvents.emit({
                scope,
                payload: { type: "execute", requestId, registrationId: request.registrationId },
              });
            });
          },
        },
        { ownerId: extensionId, source: "extension" },
      ),
    );
    disposables.push(
      workbench.layout.registerMenuItem(
        menu.menuPath,
        {
          id: commandId,
          commandId,
          icon: request.icon,
          order: -1,
          resourceGroup: menu.group,
        },
        { ownerId: extensionId, source: "extension" },
      ),
    );
    owner.actions.set(request.registrationId, dispose);
  };
};
