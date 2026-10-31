import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import {
  getDashboardExtensionsReadyProjectId,
  subscribeDashboardExtensionsReadyProject,
} from "@/shared/extensions/extension-readiness";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";

interface CreateBootstrapModuleInput {
  isInitialSyncComplete?: () => boolean;
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

const isCorePageLocation = (location: PageLocation | undefined) => {
  if (!location) return false;
  while (location) {
    if (location.page.extensionId !== "pstdio") return false;
    location = location.parent;
  }
  return true;
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

      const disposePending = () => {
        readyUnsubscribe?.();
        readyUnsubscribe = undefined;
        selectionUnsubscribe?.();
        selectionUnsubscribe = undefined;
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
        const isCurrent = () => run === generation && getDashboardSelectedProjectId(ctx) === projectId;
        const openProject = () => {
          if (!isCurrent()) return;
          ctx.modes.setActiveMode("project");
          const boot = () => {
            if (!isCurrent()) return false;
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
            ctx.pageLocations.boot(projectId);
            return true;
          };

          if (!boot()) {
            readyUnsubscribe = subscribeDashboardExtensionsReadyProject(ctx, boot);
          }
        };
        openProject();
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
