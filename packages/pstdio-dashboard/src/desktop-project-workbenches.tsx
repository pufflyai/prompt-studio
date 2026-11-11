import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { useEffect, useSyncExternalStore } from "react";
import type { DesktopLifecycleBridge } from "@/lib/desktop-lifecycle-bridge";
import { DesktopQuitConfirmation } from "@/modules/desktop/desktop-quit-confirmation";
import { DesktopStartupAppearance } from "@/modules/desktop/desktop-startup-appearance";
import { DesktopProjectTabs } from "@/modules/projects/components/desktop-project-tabs";
import type { DesktopProjectTabsController } from "@/modules/projects/desktop-project-tabs-controller";
import { DashboardWorkbenchView } from "@/shared/workbench/dashboard-workbench-view";

interface DesktopProjectWorkbenchesProps {
  controller: DesktopProjectTabsController;
  lifecycle: DesktopLifecycleBridge | undefined;
  platform: string;
  storage: WorkbenchStorageLike | undefined;
}

/** Keeps each loaded project tab mounted; the workbench hides the inactive ones. */
export const DesktopProjectWorkbenches = (props: DesktopProjectWorkbenchesProps) => {
  const { controller, lifecycle, platform, storage } = props;
  const { active, workbenches } = useSyncExternalStore(
    controller.subscribeState,
    controller.getState,
    controller.getState,
  );
  useEffect(() => controller.disposeReleased());

  return workbenches.map((entry) => (
    <DashboardWorkbenchView
      key={entry.key}
      panelControlsPlacement="host"
      workbench={entry.workbench}
      storage={storage}
      titleBar={
        <>
          <DesktopProjectTabs workbench={entry.workbench} controller={controller} platform={platform} />
          {/* Window-wide parts follow the visible project: one startup theme, one quit dialog. */}
          {entry === active && lifecycle && <DesktopStartupAppearance bridge={lifecycle} />}
          {entry === active && lifecycle && <DesktopQuitConfirmation bridge={lifecycle} />}
        </>
      }
    />
  ));
};
