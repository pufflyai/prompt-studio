import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchCore, WorkbenchPanelInstance } from "../../core";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";
import type { ExtensionWebviewHostAdapters } from "./extension-webview-host-adapters";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";
import { createWorkbenchEditingSessionAdapter } from "./webview-editing-session";
import { createWebviewPreferencesAdapter, type WebviewOwnedPreferences } from "./webview-preferences-capability";
import { createWebviewResourceActions } from "./webview-resource-actions";

interface CreateWorkbenchWebviewHostAdaptersInput {
  workbench: WorkbenchCore;
  placement?: WorkbenchPanelInstance;
  extensionId?: string;
  projectId?: string;
  ownedPreferences?: WebviewOwnedPreferences;
  warn?: (message: string) => void;
  hostEvents?: HostEventPublisher;
}

export const createWorkbenchWebviewHostAdapters = (input: CreateWorkbenchWebviewHostAdaptersInput) => {
  const { workbench, placement, extensionId, projectId, hostEvents } = input;
  return {
    resourceActions: createWebviewResourceActions(workbench, projectId, hostEvents),
    hostEvents,
    editing: createWorkbenchEditingSessionAdapter(input),
    executeCommand: async (request, signal) => ({
      outcome: {
        ok: true,
        status: "success",
        value: await workbench.commands.executeCommand(request.commandId, request.params, {
          resource: request.resource,
          signal,
        }),
      },
    }),
    placement: placement?.placementIdentity
      ? { close: () => workbench.closePlacement(placement.placementIdentity!) }
      : undefined,
    pageParams: {
      update: (patch) => {
        const state = workbench.pages.store.getState();
        if (!state.location) throw new Error("page_params_no_page");
        if (!extensionId || extensionId !== state.location.page.extensionId) throw new Error("page_params_not_owner");
        return workbench.pageLocations.updateParams(patch);
      },
    },
    navigation: {
      open: (target) =>
        workbench.navigation.openTarget(toWorkbenchNavigationTarget(target, { extensionId, projectId })),
    },
    notifications: {
      show: (notice) => {
        if (notice.type === "error") {
          workbench.notifications.captureActionError(
            notice.title ?? "Extension action",
            placement?.instanceId,
          )(new Error(notice.message));
          return;
        }
        workbench.notifications.show({
          level: notice.type,
          metadata: notice.metadata,
          title: notice.title ?? notice.message,
          message: notice.title === undefined ? undefined : notice.message,
        });
      },
    },
    preferences: createWebviewPreferencesAdapter(input),
    terminal: workbench.terminal,
  } satisfies ExtensionWebviewHostAdapters;
};

export const createWorkbenchWebviewHostCapabilities = (input: CreateWorkbenchWebviewHostAdaptersInput) =>
  createExtensionWebviewHostCapabilities(createWorkbenchWebviewHostAdapters(input));
