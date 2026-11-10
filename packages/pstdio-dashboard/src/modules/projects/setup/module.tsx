import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import {
  getDashboardExtensionsReadyProjectId,
  subscribeDashboardExtensionsReadyProject,
} from "@/shared/extensions/extension-readiness";
import {
  getCachedDashboardExtensionMetadata,
  subscribeDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";

const setupOverlayPrefix = "dashboard.project-opening.setup.";
const ownedContributionPrefix = `workbench.overlay.${encodeURIComponent(setupOverlayPrefix)}`;
const overlayConfig = {
  placement: "center" as const,
  scrollBehavior: "inside" as const,
  closeOnInteractOutside: false,
  contentWidth: "2xl",
  contentHeight: "xl",
  contentMaxWidth: "calc(100vw - {spacing.xl})",
  contentMaxHeight: "calc(100dvh - {spacing.xl})",
};
type OpeningRequest = {
  projectId?: string;
  instanceId?: string;
  views?: string[];
  viewId?: string;
  registrations: { dispose(): void }[];
  finish(): void;
};

// Owns only a single explicit project-opening request. Enabled extensions own setup content/state.
export const createProjectOpeningModule = () => {
  let context: WorkbenchModuleContext;
  let request: OpeningRequest | undefined;
  let cleaning = false;
  const removeOrphans = (keep?: string) => {
    if (cleaning) return;
    cleaning = true;
    try {
      for (const placement of context.layout.getLayout().regions.overlay.widgets)
        if (placement.contributionId.startsWith(ownedContributionPrefix) && placement.widgetId !== keep)
          context.overlays.closeOverlay(placement.widgetId);
    } finally {
      cleaning = false;
    }
  };
  const exists = (id: string) =>
    context.layout.listPanelInstances("overlay").some(({ instanceId }) => instanceId === id);
  const close = () => {
    const previous = request;
    request = undefined;
    if (!previous) return;
    if (previous.instanceId) context.overlays.closeOverlay(previous.instanceId);
    for (const registration of previous.registrations) registration.dispose();
    previous.finish();
  };
  const present = (pending: OpeningRequest, viewId: string) => {
    pending.instanceId = context.overlays.openOverlay(`${setupOverlayPrefix}${viewId}`, { title: "Setup" });
  };
  const next = (pending: OpeningRequest) => {
    const oldId = pending.instanceId;
    pending.instanceId = undefined;
    if (oldId) context.overlays.closeOverlay(oldId);
    const viewId = pending.views?.shift();
    if (!viewId) {
      close();
      return;
    }
    pending.viewId = viewId;
    pending.registrations.push(
      context.overlays.registerOverlay({
        id: `${setupOverlayPrefix}${viewId}`,
        viewId,
        closable: false,
        config: overlayConfig,
      }),
    );
    present(pending, viewId);
    pending.finish();
  };
  const ready = () => {
    const pending = request;
    if (!pending?.projectId || pending.views || getDashboardExtensionsReadyProjectId(context) !== pending.projectId)
      return;
    if (getDashboardSelectedProjectId(context) !== pending.projectId) return;
    const metadata = getCachedDashboardExtensionMetadata(pending.projectId);
    if (!metadata) return;
    pending.views = (metadata.projectSetups ?? []).map(({ view }) => `${view.extensionId}.view.${view.id}`);
    next(pending);
  };
  const open = async (project: Promise<{ id: string; created?: boolean }>) => {
    close();
    const completion = Promise.withResolvers<void>();
    const pending: OpeningRequest = { registrations: [], finish: () => completion.resolve() };
    request = pending;
    try {
      const opened = await project;
      if (request !== pending) return;
      // Reopening a folder's existing project is ordinary navigation, so it does not replay setup.
      if (!opened.created) {
        close();
        return;
      }
      pending.projectId = opened.id;
      // Selection happens in the creator after this promise resolves; registration may finish later.
      ready();
      await completion.promise;
    } catch {
      if (request === pending) close();
      // The project creator owns its recoverable error beside the folder picker.
    }
  };
  const module = {
    id: "dashboard.project-opening",
    activate(ctx) {
      context = ctx;
      // Requests are transient: a saved placement has no live owner after reload.
      removeOrphans();
      let rotating = false;
      let scopeRequest: OpeningRequest | undefined;
      const before = ctx.layout.onWillChangePersistenceScope(() => {
        if (request?.instanceId && !exists(request.instanceId)) close();
        scopeRequest = request;
        rotating = true;
      });
      const after = ctx.layout.onDidChangePersistenceScope(() => {
        const pending = scopeRequest;
        scopeRequest = undefined;
        if (pending && request === pending && pending.instanceId && pending.viewId && !exists(pending.instanceId))
          present(pending, pending.viewId);
        removeOrphans(request?.instanceId);
        rotating = false;
      });
      const selection = subscribeDashboardSelectedProject(ctx, () => {
        if (request && getDashboardSelectedProjectId(ctx) !== request.projectId) close();
        else ready();
      });
      const registration = subscribeDashboardExtensionsReadyProject(ctx, ready);
      const metadata = subscribeDashboardExtensionMetadata(
        () => {
          const pending = request;
          if (!pending) removeOrphans();
          if (!pending?.projectId || !pending.views) return;
          const allowed = new Set(
            (getCachedDashboardExtensionMetadata(pending.projectId)?.projectSetups ?? []).map(
              ({ view }) => `${view.extensionId}.view.${view.id}`,
            ),
          );
          pending.views = pending.views.filter((viewId) => allowed.has(viewId));
          if (pending.viewId && !allowed.has(pending.viewId)) next(pending);
        },
        undefined,
        () => request?.projectId ?? getDashboardSelectedProjectId(ctx),
      );
      const layout = ctx.layout.store.subscribe(() => {
        if (!rotating && !request) removeOrphans();
        const pending = request;
        if (!rotating && pending?.instanceId && !exists(pending.instanceId)) {
          if (pending.views) next(pending);
          else close();
        }
      });
      return [
        {
          dispose() {
            close();
            selection();
            registration();
            metadata();
            layout();
            before.dispose();
            after.dispose();
          },
        },
      ];
    },
  } satisfies WorkbenchModuleContribution;
  return { module, open };
};
