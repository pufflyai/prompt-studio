import { Spinner } from "@chakra-ui/react";
import { batchWorkbenchChanges, type WorkbenchModuleContribution } from "@pstdio/workbench";
import { createElement } from "react";
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
      const loadingViewId = "dashboard.bootstrap.loading";
      ctx.views.registerView({
        id: loadingViewId,
        title: "Loading project",
        body: { kind: "react", render: () => createElement(Spinner, { size: "sm", margin: "auto" }) },
      });

      let generation = 0;
      let readyUnsubscribe: (() => void) | undefined;
      let selectionUnsubscribe: (() => void) | undefined;
      let locationUnsubscribe: (() => void) | undefined;
      let loadingPlaceholder: { dispose(): void } | undefined;
      const clearLoading = () => {
        loadingPlaceholder?.dispose();
        loadingPlaceholder = undefined;
      };

      const disposePending = () => {
        readyUnsubscribe?.();
        readyUnsubscribe = undefined;
        selectionUnsubscribe?.();
        selectionUnsubscribe = undefined;
        locationUnsubscribe?.();
        locationUnsubscribe = undefined;
        clearLoading();
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
            clearLoading();
            readyUnsubscribe?.();
            readyUnsubscribe = undefined;
            return true;
          }
          // Resolve automatic destinations only after this project's contributions arrive.
          // A core fallback must not consume an extension landing page's first navigation.
          if (getDashboardExtensionsReadyProjectId(ctx) !== projectId) return false;
          readyUnsubscribe?.();
          readyUnsubscribe = undefined;
          batchWorkbenchChanges(() => {
            // Recovery and other shell dialogs can open while metadata loads.
            // Restoring the destination's layout must preserve those live overlays.
            const overlay = ctx.layout.getLayout().regions.overlay;
            ctx.pageLocations.boot(projectId);
            if (overlay.widgets.length) {
              const layout = ctx.layout.getLayout();
              ctx.layout.restoreLayout({ ...layout, regions: { ...layout.regions, overlay } });
            }
            clearLoading();
          });
          return true;
        };

        if (!boot()) {
          loadingPlaceholder = ctx.placeholders.registerPlaceholder({
            id: loadingViewId,
            viewId: loadingViewId,
            region: "main",
          });
          locationUnsubscribe = ctx.pages.store.subscribeSelector(
            (state) => state.location,
            (location) => {
              if (location) clearLoading();
            },
          );
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
