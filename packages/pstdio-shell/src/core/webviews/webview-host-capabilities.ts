import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import type { ActivityItem } from "../activity/activity-registry";
import type { ShellDiagnostic } from "../diagnostics/diagnostic-registry";
import type { PreferenceScopeRef, PreferenceValue } from "../preferences/preference-registry";
import type { OpenResourceInput, ResourceRef } from "../resources/resource-registry";
import type { ShellCore } from "../shell-core";

interface CreateShellWebviewHostCapabilitiesInput {
  dispatchKeyboardEvent?: (event: KeyboardEventInit) => void;
  shell: ShellCore;
  webviewId: string;
}

const dispatchDocumentKeyboardEvent = (params: KeyboardEventInit) => {
  if (typeof document === "undefined") return;
  const event = new KeyboardEvent("keydown", { ...params, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
};

export const createShellWebviewHostCapabilities = (input: CreateShellWebviewHostCapabilitiesInput) =>
  ({
    "commands.execute": (params: unknown) => {
      const request = params as { commandId: string; params?: unknown };
      return input.shell.commands.executeCommand(request.commandId, request.params);
    },
    "resource.open": (params: unknown) => {
      const request = params as { input?: OpenResourceInput; resource?: ResourceRef };
      if (!request.resource) throw new Error("resource.open requires a resource.");
      return input.shell.resources.openResource(request.resource, request.input);
    },
    "notification.show": (params: unknown) => {
      const notification = params as Parameters<ShellCore["notifications"]["show"]>[0];
      return input.shell.notifications.show({
        level: notification.level,
        message: notification.message,
        title: notification.title,
      });
    },
    "preferences.get": (params: unknown) => {
      const request = params as { name: string; scope?: PreferenceScopeRef };
      return input.shell.preferences.getValue(request.name, request.scope);
    },
    "preferences.set": (params: unknown) => {
      const request = params as { name: string; scope?: PreferenceScopeRef; value: PreferenceValue };
      input.shell.preferences.setValue(request.name, request.value, request.scope ?? { scope: "user" });
      return { name: request.name, value: request.value };
    },
    "activity.emit": (params: unknown) => input.shell.activity.emit(params as ActivityItem),
    "diagnostics.report": (params: unknown) => {
      const diagnostic = params as ShellDiagnostic;
      return input.shell.diagnostics.report({
        ...diagnostic,
        metadata: {
          ...(diagnostic.metadata ?? {}),
          webviewId: input.webviewId,
        },
      });
    },
    "host.dispatchKeyboardEvent": (params: unknown) =>
      (input.dispatchKeyboardEvent ?? dispatchDocumentKeyboardEvent)(params as KeyboardEventInit),
  }) satisfies HostCapabilityRegistry;
