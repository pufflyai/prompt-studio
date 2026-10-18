import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { NavigationTarget, WorkbenchCore, WorkbenchPanelInstance } from "../../core";
import { createTerminalSessionCapability } from "./terminal-session-capability";
import { createWebviewPreferencesCapabilities, type WebviewOwnedPreferences } from "./webview-preferences-capability";

interface CreateWorkbenchWebviewHostCapabilitiesInput {
  workbench: WorkbenchCore;
  placement?: WorkbenchPanelInstance;
  extensionId?: string;
  ownedPreferences?: WebviewOwnedPreferences;
  warn?: (message: string) => void;
  /** Event channel into the guest; terminal.session is only offered when present. */
  hostEvents?: HostEventPublisher;
}

export const createWorkbenchWebviewHostCapabilities = (input: CreateWorkbenchWebviewHostCapabilitiesInput) =>
  ({
    ...(input.placement?.placementIdentity
      ? {
          "placement.close": (params: unknown) => {
            if (
              params !== undefined &&
              (typeof params !== "object" || params === null || Array.isArray(params) || Object.keys(params).length > 0)
            ) {
              throw new Error("placement.close takes no parameters; the host supplies the calling placement.");
            }
            input.workbench.closePlacement(input.placement!.placementIdentity!);
          },
        }
      : {}),
    "commands.execute": (params: unknown) => {
      const request = params as { commandId: string; params?: unknown };
      return input.workbench.commands.executeCommand(request.commandId, request.params);
    },
    "page.params.update": (params: unknown) => {
      const state = input.workbench.pages.store.getState();
      if (!state.location) throw new Error("page_params_no_page");
      if (!input.extensionId || input.extensionId !== state.location.page.extensionId)
        throw new Error("page_params_not_owner");
      const patch = (params as { params: Parameters<WorkbenchCore["pageLocations"]["updateParams"]>[0] }).params;
      return { location: input.workbench.pageLocations.updateParams(patch) };
    },
    "navigation.open": (params: unknown) => {
      const request = params as { target?: NavigationTarget };
      if (!request.target) throw new Error("navigation.open requires a target.");
      return input.workbench.navigation.openTarget(request.target);
    },
    "notification.show": (params: unknown) => {
      const notification = params as Parameters<WorkbenchCore["notifications"]["show"]>[0];
      return input.workbench.notifications.show({
        level: notification.level,
        message: notification.message,
        title: notification.title,
      });
    },
    ...createWebviewPreferencesCapabilities(input),
    ...(input.hostEvents
      ? {
          "terminal.session": createTerminalSessionCapability({
            terminal: input.workbench.terminal,
            hostEvents: input.hostEvents,
          }),
        }
      : {}),
  }) satisfies HostCapabilityRegistry;
