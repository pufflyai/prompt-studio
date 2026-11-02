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
          // Resolve automatic destinations only after this project's contributions arrive.
          // A core fallback must not consume an extension landing page's first navigation.
          if (getDashboardExtensionsReadyProjectId(ctx) !== projectId) return false;
          readyUnsubscribe?.();
          readyUnsubscribe = undefined;
          const result = ctx.pageLocations.boot(projectId);
          if (!result.ok) return true;
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
