import { ErrorBoundary } from "@pstdio/ui";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { useEffect, useSyncExternalStore } from "react";
import type { DesktopLifecycleBridge } from "@/lib/desktop-lifecycle-bridge";
import { reportWorkbenchError } from "@/lib/workbench-error-report";
import { DesktopQuitConfirmation } from "@/modules/desktop/desktop-quit-confirmation";
import { DesktopStartupAppearance } from "@/modules/desktop/desktop-startup-appearance";
import { DesktopProjectRecovery } from "@/modules/projects/components/desktop-project-recovery";
import { DesktopProjectTabs } from "@/modules/projects/components/desktop-project-tabs";
import type { DesktopProjectTabsController } from "@/modules/projects/desktop-project-tabs-controller";
import { DesktopUpgradeConfirmation, type DesktopUpgradeController } from "@/modules/updates/desktop-upgrade";
import { DashboardWorkbenchView } from "@/shared/workbench/dashboard-workbench-view";

interface DesktopProjectWorkbenchesProps {
  controller: DesktopProjectTabsController;
  lifecycle: DesktopLifecycleBridge | undefined;
  upgrade: DesktopUpgradeController | undefined;
  platform: string;
  storage: WorkbenchStorageLike | undefined;
}

/** Keeps each loaded project tab mounted; the workbench hides the inactive ones. */
export const DesktopProjectWorkbenches = (props: DesktopProjectWorkbenchesProps) => {
  const { controller, lifecycle, platform, storage, upgrade } = props;
  const { active, workbenches } = useSyncExternalStore(
    controller.subscribeState,
    controller.getState,
    controller.getState,
  );
  useEffect(() => controller.disposeReleased());

  return workbenches.map((entry) => {
    const visible = entry === active;
    const quitConfirmation = visible && lifecycle && <DesktopQuitConfirmation bridge={lifecycle} />;
    const recovery = (
      <DesktopProjectRecovery {...{ controller, entry, platform, storage, visible }}>
        {quitConfirmation}
      </DesktopProjectRecovery>
    );
    return (
      <ErrorBoundary
        key={entry.key}
        fallback={recovery}
        onError={(error, info) => {
          controller.fail(entry);
          reportWorkbenchError(error, entry.projectId, info.componentStack);
        }}
      >
        {entry.workbench ? (
          <DashboardWorkbenchView
            panelControlsPlacement="host"
            workbench={entry.workbench}
            storage={storage}
            titleBar={
              <>
                <DesktopProjectTabs workbench={entry.workbench} controller={controller} platform={platform} />
                {/* Window-wide parts follow the visible project: one startup theme, one quit dialog. */}
                {visible && lifecycle && <DesktopStartupAppearance bridge={lifecycle} />}
                {quitConfirmation}
                {visible && upgrade && <DesktopUpgradeConfirmation workbench={entry.workbench} upgrade={upgrade} />}
              </>
            }
          />
        ) : (
          recovery
        )}
      </ErrorBoundary>
    );
  });
};
