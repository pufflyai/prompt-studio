import type { PageLocation } from "@pstdio/sdk/extensions";
import { batchWorkbenchChanges, type WorkbenchModuleContribution } from "@pstdio/workbench";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import {
  getDashboardExtensionsReadyProjectId,
  getDashboardExtensionsRegisteredProjectId,
  subscribeDashboardExtensionsReadyProject,
  subscribeDashboardExtensionsRegisteredProject,
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
      let waitingUnsubscribe: (() => void) | undefined;
      let selectionUnsubscribe: (() => void) | undefined;

      const disposePending = () => {
        waitingUnsubscribe?.();
        waitingUnsubscribe = undefined;
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
            waitingUnsubscribe?.();
            waitingUnsubscribe = undefined;
            return true;
          }
          // Registered extension pages may still belong to the previous project.
          // Restore only core page paths before this project's metadata arrives,
          // preserving extension URLs and saved parents until their pages register.
          // This project's registered pages can serve a URL while a newer catalog read
          // loads; a URL they cannot serve waits for that newest read.
          const location = ctx.pageLocations.getBootLocation(projectId);
          const registered = getDashboardExtensionsRegisteredProjectId(ctx) === projectId && location !== undefined;
          if (getDashboardExtensionsReadyProjectId(ctx) !== projectId && !registered && !isCorePageLocation(location)) {
            return false;
          }
          waitingUnsubscribe?.();
          waitingUnsubscribe = undefined;
          batchWorkbenchChanges(() => {
            const overlay = ctx.layout.getLayout().regions.overlay;
            ctx.pageLocations.boot(projectId);
            if (overlay.widgets.length) {
              const layout = ctx.layout.getLayout();
              ctx.layout.restoreLayout({ ...layout, regions: { ...layout.regions, overlay } });
            }
          });
          return true;
        };

        if (!boot()) {
          const registered = subscribeDashboardExtensionsRegisteredProject(ctx, boot);
          const ready = subscribeDashboardExtensionsReadyProject(ctx, boot);
          waitingUnsubscribe = () => {
            registered();
            ready();
          };
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
