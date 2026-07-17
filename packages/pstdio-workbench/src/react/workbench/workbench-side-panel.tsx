import { IconButton, Spacer } from "@chakra-ui/react";
import { Header, SidePanel, Tooltip } from "@pstdio/ui";
import { Minimize2, PanelRight, X } from "lucide-react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchArea } from "../area/area";
import { WorkbenchAreaTabs } from "../area/area-tabs";
import { WorkbenchHeaderBorder } from "./header-bottom-border";
import { PanelMenuHost } from "./panel-menu-host";
import { setWorkbenchPanelOpen } from "./workbench-panel-state";

export type WorkbenchSidePanelPresentation = "docked" | "floating";

interface WorkbenchSidePanelProps {
  workbench: WorkbenchCore;
  presentation: WorkbenchSidePanelPresentation;
}

const WorkbenchSidePanelHeader = (props: WorkbenchSidePanelProps) => {
  const { workbench, presentation } = props;
  const nextPresentation = presentation === "docked" ? "floating" : "docked";
  const presentationLabel = presentation === "docked" ? "Float side panel" : "Dock side panel";

  return (
    <Header variant="main" position="relative" w="full" gap="xs" overflow="hidden">
      <WorkbenchAreaTabs workbench={workbench} area="side" forceVisible showAddMenu />
      <Spacer />
      <Tooltip content={presentationLabel}>
        <IconButton
          flexShrink={0}
          size="xs"
          variant="ghost"
          aria-label={presentationLabel}
          onClick={() => {
            workbench.layout.setAreaPresentation("side", nextPresentation);
            setWorkbenchPanelOpen(workbench, "side", true);
          }}
        >
          {presentation === "docked" ? <Minimize2 size={16} /> : <PanelRight size={16} />}
        </IconButton>
      </Tooltip>
      <Tooltip content="Close side panel">
        <IconButton
          flexShrink={0}
          size="xs"
          variant="ghost"
          aria-label="Close side panel"
          onClick={() => setWorkbenchPanelOpen(workbench, "side", false)}
        >
          <X size={16} />
        </IconButton>
      </Tooltip>
      <WorkbenchHeaderBorder workbench={workbench} area="side" />
    </Header>
  );
};

export const WorkbenchSidePanel = (props: WorkbenchSidePanelProps) => {
  const { workbench, presentation } = props;

  return (
    <SidePanel
      presentation={presentation}
      data-testid={`workbench-side-panel-${presentation}`}
      aria-label="Side panel"
      header={<WorkbenchSidePanelHeader workbench={workbench} presentation={presentation} />}
    >
      <PanelMenuHost workbench={workbench} area="side">
        <WorkbenchArea workbench={workbench} area="side" title="Side panel" />
      </PanelMenuHost>
    </SidePanel>
  );
};
