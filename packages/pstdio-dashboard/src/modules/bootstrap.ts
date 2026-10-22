import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import type { DashboardSessionSelectionPersistence } from "@/shared/app/session-selection-persistence";
import {
  getDashboardExtensionsReadyProjectId,
  subscribeDashboardExtensionsReadyProject,
} from "@/shared/extensions/extension-readiness";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { findDashboardSession } from "./sessions/data/dashboard-sessions";

interface CreateBootstrapModuleInput {
  isInitialSyncComplete?: () => boolean;
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
  sessionSelectionPersistence?: DashboardSessionSelectionPersistence;
}

type BootstrapContext = Parameters<WorkbenchModuleContribution["activate"]>[0];

const isCorePageLocation = (location: PageLocation | undefined) => {
  if (!location) return false;
  while (location) {
    if (location.page.extensionId !== "pstdio") return false;
    location = location.parent;
  }
  return true;
};

const selectedSession = (ctx: BootstrapContext, sessionId: string) =>
  findDashboardSession(sessionId, getDashboardSelectedProjectId(ctx));

const restoreSelectedSession = (
  ctx: BootstrapContext,
  sessionId: string | undefined,
  isCurrent: () => boolean,
  isInitialSyncComplete: () => boolean,
) => {
  if (!sessionId) return undefined;
  let unsubscribe: (() => void) | undefined;

  const restore = () => {
    if (!isCurrent() || ctx.modes.getActiveModeId() !== "project") {
      unsubscribe?.();
      unsubscribe = undefined;
      return;
    }
    const session = selectedSession(ctx, sessionId);
    if (session && ctx.commands.getCommand(dashboardCommandIds.openSessionPanel)) {
      unsubscribe?.();
      unsubscribe = undefined;
      void ctx.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
        preservePanelMode: true,
        resource: session.resource,
      });
      return;
    }
    if (isInitialSyncComplete()) {
      unsubscribe?.();
      unsubscribe = undefined;
    }
  };

  restore();
  if (!unsubscribe && !isInitialSyncComplete() && isCurrent()) {
    unsubscribe = subscribeDashboardData(restore);
  }
  return { dispose: () => unsubscribe?.() };
};

export const createBootstrapModule = (input: CreateBootstrapModuleInput = {}) =>
  ({
    id: "dashboard.bootstrap",
    activate(ctx) {
      const isInitialSyncComplete = input.isInitialSyncComplete ?? isInitialCollectionsSyncComplete;
      ctx.context.set("project.open", true);

      let generation = 0;
      let readyUnsubscribe: (() => void) | undefined;
      let selectionUnsubscribe: (() => void) | undefined;
      let sessionRestore: { dispose(): void } | undefined;

      const disposePending = () => {
        readyUnsubscribe?.();
        readyUnsubscribe = undefined;
        selectionUnsubscribe?.();
        selectionUnsubscribe = undefined;
        sessionRestore?.dispose();
        sessionRestore = undefined;
      };

      const enterProjectSelection = () => {
        ctx.pageLocations.clearProject();
        ctx.modes.setActiveMode("project-selection");
      };

      const bootSelectedProject = () => {
        const run = ++generation;
        disposePending();
        const projectId = getDashboardSelectedProjectId(ctx);
        if (!projectId) {
          if (input.projectSelectionPersistence?.getSelectedProjectId() && !isInitialSyncComplete()) {
            selectionUnsubscribe = subscribeDashboardData(() => {
              if (run !== generation) return;
              const persistedProjectId = input.projectSelectionPersistence?.getSelectedProjectId();
              if (!getDashboardSelectedProjectId(ctx) && persistedProjectId && !isInitialSyncComplete()) {
                return;
              }
              bootSelectedProject();
            });
            return;
          }
          enterProjectSelection();
          return;
        }

        ctx.pageLocations.setProject(projectId);
        ctx.modes.setActiveMode("project");
        const boot = () => {
          if (run !== generation || getDashboardSelectedProjectId(ctx) !== projectId) return false;
          // A user can navigate through the core shell while an extension URL waits.
          // That committed location takes precedence over the delayed restore.
          if (ctx.pages.store.getState().location) {
            readyUnsubscribe?.();
            readyUnsubscribe = undefined;
            return true;
          }
          // Registered extension pages may still belong to the previous project.
          // Restore only core page paths before this project's metadata arrives,
          // preserving extension URLs and saved parents until their pages register.
          if (
            getDashboardExtensionsReadyProjectId(ctx) !== projectId &&
            !isCorePageLocation(ctx.pageLocations.getBootLocation(projectId))
          ) {
            return false;
          }
          readyUnsubscribe?.();
          readyUnsubscribe = undefined;
          const result = ctx.pageLocations.boot(projectId);
          if (!result.ok) return true;
          sessionRestore = restoreSelectedSession(
            ctx,
            input.sessionSelectionPersistence?.getSelectedSessionId(),
            () => run === generation && getDashboardSelectedProjectId(ctx) === projectId,
            isInitialSyncComplete,
          );
          return true;
        };

        if (!boot()) {
          readyUnsubscribe = subscribeDashboardExtensionsReadyProject(ctx, boot);
        }
      };

      bootSelectedProject();
      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, bootSelectedProject);

      return {
        dispose() {
          generation += 1;
          disposePending();
          unsubscribeProject();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
