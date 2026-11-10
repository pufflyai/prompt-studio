import { isWorkbenchRetiring } from "../../core/workbench-required-work";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";
import type { ExtensionWebviewHostAdapters } from "./extension-webview-host-adapters";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";
import { updateOverlayPageParams } from "./overlay-page-params";
import { createWorkbenchEditingSessionAdapter } from "./webview-editing-adapter";
import { createWebviewPreferencesAdapter, type WebviewOwnedPreferences } from "./webview-preferences-capability";
import { createWebviewResourceActions } from "./webview-resource-actions";
import { createWorkbenchTextEditingAdapter, type WorkbenchTextEditingInput } from "./webview-text-editing";

interface CreateWorkbenchWebviewHostAdaptersInput extends WorkbenchTextEditingInput {
  extensionId?: string;
  ownedPreferences?: WebviewOwnedPreferences;
  warn?: (message: string) => void;
  executeCommand?: ExtensionWebviewHostAdapters["executeCommand"];
}

export const createWorkbenchWebviewHostAdapters = (input: CreateWorkbenchWebviewHostAdaptersInput) => {
  const { workbench, placement, extensionId, projectId, hostEvents } = input;
  const captured = workbench.viewers.captureContext(placement?.placementIdentity);
  const overlayCurrent = placement && workbench.overlays.captureInvocation(placement.instanceId);
  const invocation = {
    ...captured,
    isViewerCurrent: () => captured.isViewerCurrent?.() !== false && overlayCurrent?.() !== false,
  };
  const requireCurrentViewer = () => {
    if (projectId && projectId !== workbench.pages.store.getState().projectId)
      throw new Error("The calling view belongs to another project");
    if (invocation.isViewerCurrent?.() === false) throw new Error("The calling viewer is no longer open");
  };
  const isOverlay = () =>
    workbench.layout.getLayout().regions.overlay.widgets.some((widget) => widget.widgetId === placement?.instanceId);
  const resourceActions = createWebviewResourceActions(workbench, projectId, hostEvents, placement?.placementIdentity);
  const editing = createWorkbenchEditingSessionAdapter(input);
  const executeCaptured: NonNullable<ExtensionWebviewHostAdapters["executeCommand"]> = async (
    request,
    signal,
    context = invocation,
  ) => {
    // Accepted persistence keeps its captured project/resource; late UI navigation still checks the original viewer.
    if (input.executeCommand)
      return input.executeCommand(request, signal, { ...context, isViewerCurrent: invocation.isViewerCurrent });
    return {
      outcome: {
        ok: true,
        status: "success",
        value: await workbench.commands.executeCommand(request.commandId, request.params, {
          resource: request.resource ?? placement?.resource,
          placement: placement?.placementIdentity,
          projectId,
          signal,
          removalVersion: context.removalVersion,
          isViewerCurrent: context.isViewerCurrent,
        }),
      },
    };
  };
  return {
    resourceActions: async (request) => {
      requireCurrentViewer();
      return resourceActions(request);
    },
    hostEvents,
    textEditing: createWorkbenchTextEditingAdapter(input),
    editing: editing && {
      request(request, execute) {
        if (request.operation !== "close" && !isWorkbenchRetiring(workbench)) requireCurrentViewer();
        return editing.request(request, execute);
      },
    },
    executeEditingCommand: (request, signal) =>
      executeCaptured(request, signal, { ...invocation, isViewerCurrent: undefined }),
    executeCommand: async (request, signal) => {
      requireCurrentViewer();
      return executeCaptured(request, signal);
    },
    placement:
      placement && (placement.placementIdentity || isOverlay())
        ? {
            close: () => {
              requireCurrentViewer();
              if (placement.placementIdentity) return workbench.closePlacement(placement.placementIdentity);
              if (!isOverlay()) throw new Error("The calling viewer is no longer open");
              workbench.overlays.closeOverlay(placement.instanceId);
            },
          }
        : undefined,
    pageParams: {
      update: (patch) => {
        requireCurrentViewer();
        if (placement?.pageContext && isOverlay())
          return updateOverlayPageParams(workbench, placement, extensionId, patch);
        const state = workbench.pages.store.getState();
        if (!state.location) throw new Error("page_params_no_page");
        if (!extensionId || extensionId !== state.location.page.extensionId) throw new Error("page_params_not_owner");
        return workbench.pageLocations.updateParams(patch);
      },
    },
    navigation: {
      open: (target) => {
        if (overlayCurrent?.() === false) throw new Error("The calling viewer is no longer open");
        return workbench.navigation.openTarget(toWorkbenchNavigationTarget(target, { extensionId, projectId }), {
          ...invocation,
          projectId: projectId ?? invocation.projectId,
        });
      },
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
  createExtensionWebviewHostCapabilities(
    createWorkbenchWebviewHostAdapters(input),
    JSON.stringify([
      input.projectId ?? input.workbench.pages.store.getState().projectId,
      input.extensionId,
      input.webviewId ?? input.placement?.viewId,
      input.placement?.instanceId,
    ]),
  );
