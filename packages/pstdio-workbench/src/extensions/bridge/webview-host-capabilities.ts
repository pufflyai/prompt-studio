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
  const invocation = workbench.viewers.captureContext(placement?.placementIdentity);
  const requireCurrentViewer = () => {
    if (projectId && projectId !== workbench.pages.store.getState().projectId)
      throw new Error("The calling view belongs to another project");
    if (invocation.isViewerCurrent?.() === false) throw new Error("The calling viewer is no longer open");
  };
  const resourceActions = createWebviewResourceActions(workbench, projectId, hostEvents, placement?.placementIdentity);
  return {
    resourceActions: async (request) => {
      requireCurrentViewer();
      return resourceActions(request);
    },
    hostEvents,
    editing: createWorkbenchEditingSessionAdapter(input),
    executeCommand: async (request, signal) => {
      requireCurrentViewer();
      return {
        outcome: {
          ok: true,
          status: "success",
          value: await workbench.commands.executeCommand(request.commandId, request.params, {
            resource: request.resource ?? placement?.resource,
            placement: placement?.placementIdentity,
            projectId,
            signal,
            removalVersion: invocation.removalVersion,
            isViewerCurrent: invocation.isViewerCurrent,
          }),
        },
      };
    },
    placement: placement?.placementIdentity
      ? {
          close: () => {
            requireCurrentViewer();
            return workbench.closePlacement(placement.placementIdentity!);
          },
        }
      : undefined,
    pageParams: {
      update: (patch) => {
        requireCurrentViewer();
        const state = workbench.pages.store.getState();
        if (!state.location) throw new Error("page_params_no_page");
        if (!extensionId || extensionId !== state.location.page.extensionId) throw new Error("page_params_not_owner");
        return workbench.pageLocations.updateParams(patch);
      },
    },
    navigation: {
      open: (target) =>
        workbench.navigation.openTarget(toWorkbenchNavigationTarget(target, { extensionId, projectId }), {
          ...invocation,
          projectId: projectId ?? invocation.projectId,
        }),
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
