import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { OpenResourceInput, PreferenceScopeRef, PreferenceValue, ResourceRef, WorkbenchCore } from "../../core";
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

export const createWorkbenchWebviewHostCapabilities = (input: CreateWorkbenchWebviewHostCapabilitiesInput) =>
  ({
    "commands.execute": (params: unknown) => {
      const request = params as { commandId: string; params?: unknown };
      return input.workbench.commands.executeCommand(request.commandId, request.params);
    },
    "resource.open": (params: unknown) => {
      const request = params as { input?: OpenResourceInput; resource?: ResourceRef };
      if (!request.resource) throw new Error("resource.open requires a resource.");
      return input.workbench.resources.openResource(request.resource, request.input);
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
