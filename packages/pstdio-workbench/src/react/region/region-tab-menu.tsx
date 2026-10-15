import { Menu, Portal, VisuallyHidden } from "@chakra-ui/react";
import { type ResourceContextAction, ResourceMenuItems } from "@pstdio/ui";
import { useId, useRef } from "react";
import type { WorkbenchCore, WorkbenchTabMenuGroup, WorkbenchWidgetPlacement } from "../../core";
import { findPlacementByWidgetId } from "../../core/registries/layout/layout-operations";
import { useWorkbenchResourceActionResolver } from "../menus/resource-actions";
import { createWorkbenchResourceMenu } from "../menus/resource-menu";
import { WorkbenchIcon } from "../shared/icon";
import { getPanelLabel } from "./panel-widget-open";

interface RegionTabMenuProps {
  anchor: { x: number; y: number; width: number; height: number; triggerId: string };
  label: string;
  open: boolean;
  setOpen(open: boolean): void;
  groups: readonly WorkbenchTabMenuGroup[];
  placement: WorkbenchWidgetPlacement;
  workbench: WorkbenchCore;
}
export const RegionTabMenu = (props: RegionTabMenuProps) => {
  const { anchor, label, open, setOpen, groups, placement, workbench } = props;
  const labelId = useId();
  useWorkbenchResourceActionResolver(workbench);
  const pending = useRef<ResourceContextAction | null>(null);
  const currentRegion = findPlacementByWidgetId(workbench.layout.getLayout(), placement.widgetId)?.regionId;
  const destinations = workbench.getPanelDestinations(placement.widgetId).filter((region) => region !== currentRegion);
  const pin = () => {
    const pinned = placement.tabRetention === "preview";
    if (placement.placementIdentity) workbench.pinPlacement(placement.placementIdentity, pinned);
    else workbench.layout.updatePanel(placement.widgetId, { strategy: { kind: pinned ? "persistent" : "preview" } });
  };
  const close = () => {
    if (placement.placementIdentity) workbench.closePlacement(placement.placementIdentity);
    else workbench.layout.closePanel(placement.widgetId);
  };
  const tabAction = (key: string, title: string, icon: string, onClick: () => void) => ({
    key,
    label: title,
    icon: <WorkbenchIcon name={icon} size={14} />,
    group: { id: "tab", label: "Tab" },
    onClick,
  });
  const actions = [
    ...createWorkbenchResourceMenu(workbench, placement.resource, { menu: groups }),
    ...(placement.tabRetention
      ? [tabAction("pin", placement.tabRetention === "preview" ? "Pin tab" : "Unpin tab", "pin", pin)]
      : []),
    ...destinations.map((region) =>
      tabAction(`move-${region}`, `Move to ${getPanelLabel(region)}`, "ArrowRight", () =>
        workbench.movePanel(placement.widgetId, region),
      ),
    ),
    ...(placement.closable ? [tabAction("close", "Close tab", "x", close)] : []),
    tabAction("reset-layout", "Reset layout", "RotateCcw", () => workbench.resetLayout()),
  ];
  return (
    <Menu.Root
      ids={{ trigger: anchor.triggerId }}
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
      onExitComplete={() => {
        const action = pending.current;
        pending.current = null;
        void action?.onClick?.();
      }}
      positioning={{ placement: "bottom-start", getAnchorRect: () => anchor, offset: { mainAxis: 0 } }}
    >
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-labelledby={labelId}>
            <VisuallyHidden id={labelId}>{label} context menu</VisuallyHidden>
            {open ? (
              <ResourceMenuItems
                actions={actions}
                onSelect={(action) => {
                  pending.current = action;
                }}
              />
            ) : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
