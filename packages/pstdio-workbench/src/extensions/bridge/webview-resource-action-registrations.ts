import type { WebviewHostCapabilityParams, WebviewResourceActionChoice } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import { batchWorkbenchChanges, type Disposable, type WorkbenchCommandExecutionContext } from "../../core";
import { placementIdentityKey } from "../../core/registries/layout/placement-reconciliation";
import { resolveResourceActionMenu } from "../../react/menus/resource-action-menu";
import type { WorkbenchTextEditingInput } from "./webview-text-editing";

const scope = "resources.actions.invoke";
type Pending = { finish(error?: string): void; cancel(): void };
type ActionLease = {
  dispose(): void;
  updateChoices(choices: readonly WebviewResourceActionChoice[], label?: string): void;
};
type Owner = { id: string; actions: Map<string, ActionLease>; pending: Map<string, Pending> };
const owners = new WeakMap<HostEventPublisher, Owner>();

const choiceMenuItem = (commandId: string, label: string, choice: WebviewResourceActionChoice) => {
  const group = { id: commandId, label };
  const radio = choice.kind !== "action";
  return {
    id: `${commandId}:${encodeURIComponent(JSON.stringify(choice.id))}`,
    label: choice.label,
    args: { choiceId: choice.id },
    selected: radio ? Boolean(choice.selected) : undefined,
    closeOnSelect: choice.closeOnSelect,
    resourceGroup: radio ? { ...group, selectionMode: "single" as const } : group,
  };
};

// A live guest owns these actions. Disconnect drops the commands and pending work;
// nothing is buffered for an eventual replacement frame to execute.
const ownerFor = (events: HostEventPublisher) => {
  const existing = owners.get(events);
  if (existing) return existing;
  const owner: Owner = { id: crypto.randomUUID(), actions: new Map(), pending: new Map() };
  owners.set(events, owner);
  const stop = events.onDisconnect(() => {
    for (const pending of owner.pending.values()) pending.finish("The action's view disconnected.");
    for (const action of [...owner.actions.values()]) action.dispose();
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
      owners.get(hostEvents)?.actions.get(request.registrationId)?.dispose();
      return;
    }
    if (request.operation === "update-choices") {
      assertCurrent();
      const action = owners.get(hostEvents)?.actions.get(request.registrationId);
      if (!action) throw new Error("The resource choice group is no longer available.");
      action.updateChoices(request.choices, request.label);
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
    let groupLabel = request.label;
    let choices = request.choices?.map((choice) => ({ ...choice }));
    const choiceFor = (args: unknown) =>
      choices?.find(
        (choice) => typeof args === "object" && args !== null && "choiceId" in args && args.choiceId === choice.id,
      );
    let active: string | undefined;
    const refreshChoices = () => {
      if (choices && owner.actions.has(request.registrationId)) batchWorkbenchChanges(renderMenu);
    };
    const disposables: Disposable[] = [];
    let menuDisposables: Disposable[] = [];
    const dispose = () => {
      owner.actions.delete(request.registrationId);
      if (active) owner.pending.get(active)?.cancel();
      for (const item of [...menuDisposables, ...disposables].reverse()) item.dispose();
    };
    disposables.push(
      workbench.commands.registerCommand(
        { id: commandId, label: request.label },
        {
          isVisible: (_args, context) => matches(context),
          isEnabled: (args, context) =>
            matches(context) && !active && (!choices || (!!choiceFor(args) && !choiceFor(args)?.disabled)),
          execute: (args, context) => {
            if (!matches(context) || active) throw new Error("This resource action is no longer available.");
            const choice = choiceFor(args);
            if (choices && (!choice || choice.disabled))
              throw new Error("This resource choice is no longer available.");
            const requestId = crypto.randomUUID();
            active = requestId;
            return new Promise<void>((resolve, reject) => {
              const finish = (error?: string) => {
                if (!owner.pending.delete(requestId)) return;
                active = undefined;
                refreshChoices();
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
              refreshChoices();
              if (!owner.pending.has(requestId)) return;
              hostEvents.emit({
                scope,
                payload: {
                  type: "execute",
                  requestId,
                  registrationId: request.registrationId,
                  ...(choice ? { choiceId: choice.id } : {}),
                },
              });
            });
          },
        },
        { ownerId: extensionId, source: "extension" },
      ),
    );
    const renderMenu = () => {
      for (const item of menuDisposables) item.dispose();
      menuDisposables = [];
      for (const choice of choices ?? [undefined]) {
        menuDisposables.push(
          workbench.layout.registerMenuItem(
            menu.menuPath,
            {
              id: commandId,
              commandId,
              icon: request.icon,
              order: choices ? 1 : -1,
              resourceGroup: menu.group,
              ...(choice ? choiceMenuItem(commandId, groupLabel, choice) : {}),
            },
            { ownerId: extensionId, source: "extension" },
          ),
        );
      }
    };
    renderMenu();
    owner.actions.set(request.registrationId, {
      dispose,
      updateChoices(next, label) {
        assertCurrent();
        if (!choices) throw new Error("Only a choice group can update its choices.");
        if (label !== undefined) groupLabel = label;
        choices = next.map((choice) => ({ ...choice }));
        renderMenu();
      },
    });
  };
};
