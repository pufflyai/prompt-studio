import type { WorkbenchCore } from "@pstdio/workbench";
import { Workbench, WorkbenchIcon } from "@pstdio/workbench/react";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import type { ReactNode } from "react";
import { openDashboardSidePanel } from "@/modules/sessions/bubble/open-side-panel";
import { createDashboardParamFieldRenderer } from "@/shared/command-params/dashboard-param-field";
import { DashboardHostPreferences } from "./dashboard-host-preferences";

interface DashboardWorkbenchViewProps {
  workbench: WorkbenchCore;
  storage: WorkbenchStorageLike | undefined;
  titleBar?: ReactNode;
  panelControlsPlacement: "host" | "nav";
}

export const DashboardWorkbenchView = (props: DashboardWorkbenchViewProps) => {
  const { workbench, storage, titleBar, panelControlsPlacement } = props;
  return (
    <Workbench
      panelControlsPlacement={panelControlsPlacement}
      workbench={workbench}
      themeStorage={storage}
      titleBar={
        <>
          <DashboardHostPreferences workbench={workbench} />
          {titleBar}
        </>
      }
      renderParamField={createDashboardParamFieldRenderer(workbench)}
      sidePanelBubbleIcon={<WorkbenchIcon name="message-circle" size={20} />}
      onOpenSidePanel={() => void openDashboardSidePanel(workbench)}
    />
  );
};
