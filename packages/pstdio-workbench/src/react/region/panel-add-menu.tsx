import { IconButton, Menu, Portal } from "@chakra-ui/react";
import { ListRow, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { useRef } from "react";
import type { ResourceRef, WorkbenchCompositionAddablePanel, WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { openPanelWidget } from "./panel-widget-open";

interface WorkbenchPanelAddMenuProps {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
  panels: readonly WorkbenchCompositionAddablePanel[];
}

export const WorkbenchPanelAddMenu = (props: WorkbenchPanelAddMenuProps) => {
  const { panels, region, resource, workbench } = props;
  const hydrating = useWorkbenchStore(workbench.history.store, (state) => state.hydrating);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = "Add panel";
  if (panels.length === 0) return null;

  const openPanel = (panel: WorkbenchCompositionAddablePanel) =>
    openPanelWidget({ workbench, widget: panel.contribution, region, resource, pinned: panel.pinned });

  const trigger = (
    <IconButton
      ref={panels.length > 1 ? triggerRef : undefined}
      size={PANEL_HEADER_CONTROL_SIZE}
      variant="ghost"
      aria-label={label}
      disabled={hydrating}
      flexShrink={0}
      onClick={panels.length === 1 ? () => openPanel(panels[0]) : undefined}
    >
      <WorkbenchIcon name="plus" size={13} />
    </IconButton>
  );

  if (panels.length === 1) return <Tooltip content={label}>{trigger}</Tooltip>;

  return (
    <Menu.Root positioning={{ placement: "bottom-start", getAnchorElement: () => triggerRef.current }}>
      <Tooltip content={label}>
        <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label={label} minW="17.5rem" bg="bg">
            {panels.map((panel) => (
              <Menu.Item
                key={panel.contribution.id}
                value={`widget:${panel.contribution.id}`}
                disabled={hydrating}
                asChild
              >
                <ListRow
                  asChild
                  variant="full-width"
                  label={panel.contribution.title}
                  icon={
                    panel.contribution.icon ? <WorkbenchIcon name={panel.contribution.icon} size={14} /> : undefined
                  }
                  disabled={hydrating}
                  onActivate={() => openPanel(panel)}
                />
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
