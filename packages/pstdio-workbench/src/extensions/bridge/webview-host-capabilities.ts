import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { PreferenceScopeRef, PreferenceValue, ResourceRef, WorkbenchCore } from "../../core";
import { toWorkbenchResource } from "../host/workbench-extension-command";
import { createTerminalSessionCapability } from "./terminal-session-capability";

interface CreateWorkbenchWebviewHostCapabilitiesInput {
  dispatchKeyboardEvent?: (event: KeyboardEventInit) => void;
  workbench: WorkbenchCore;
  /** Event channel into the guest; terminal.session is only offered when present. */
  hostEvents?: HostEventPublisher;
}

const dispatchDocumentKeyboardEvent = (params: KeyboardEventInit) => {
  if (typeof document === "undefined") return;
  const event = new KeyboardEvent("keydown", { ...params, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
};

// The guest sends contract-shaped resources ({ type, id }); the host may also hand
// this capability its own refs ({ kind, uri }). Both land as workbench refs.
const toEmittedResource = (resource: ResourceRef | { type: string; id: string }) =>
  "type" in resource ? toWorkbenchResource(resource as never) : resource;

// Opening a resource is an activation, not a page emission: native kinds keep their
// presenters (a workspace or session opens where the host puts it) and extension kinds
// are placed by the active page's bindings. The same rule every other activation path
// follows, so a webview on an extension page can still open a native kind.
export const openWorkbenchWebviewResource = (
  workbench: WorkbenchCore,
  resource: ResourceRef,
  open?: "preview" | "pin",
) => {
  const hasPresenter = workbench.resources.listPresenters().some((presenter) => presenter.canOpen(resource));
  if (hasPresenter) return workbench.resources.openResource(resource, { replaceActive: open !== "pin" });
  return workbench.pages.emitResource(resource, { open });
};

export const createWorkbenchWebviewHostCapabilities = (input: CreateWorkbenchWebviewHostCapabilitiesInput) =>
  ({
    "commands.execute": (params: unknown) => {
      const request = params as { commandId: string; params?: unknown };
      return input.workbench.commands.executeCommand(request.commandId, request.params);
    },
    "resource.open": (params: unknown) => {
      const request = params as { resource?: ResourceRef | { type: string; id: string }; open?: "preview" | "pin" };
      if (!request.resource) throw new Error("resource.open requires a resource.");
      return openWorkbenchWebviewResource(input.workbench, toEmittedResource(request.resource), request.open);
    },
    "notification.show": (params: unknown) => {
      const notification = params as Parameters<WorkbenchCore["notifications"]["show"]>[0];
      return input.workbench.notifications.show({
        level: notification.level,
        message: notification.message,
        title: notification.title,
      });
    },
    "preferences.get": (params: unknown) => {
      const request = params as { name: string; scope?: PreferenceScopeRef };
      return input.workbench.preferences.getValue(request.name, request.scope);
    },
    "preferences.set": (params: unknown) => {
      const request = params as { name: string; scope?: PreferenceScopeRef; value: PreferenceValue };
      input.workbench.preferences.setValue(request.name, request.value, request.scope ?? { scope: "user" });
      return { name: request.name, value: request.value };
    },
    "host.dispatchKeyboardEvent": (params: unknown) =>
      (input.dispatchKeyboardEvent ?? dispatchDocumentKeyboardEvent)(params as KeyboardEventInit),
    ...(input.hostEvents
      ? {
          "terminal.session": createTerminalSessionCapability({
            terminal: input.workbench.terminal,
            hostEvents: input.hostEvents,
          }),
        }
      : {}),
  }) satisfies HostCapabilityRegistry;
