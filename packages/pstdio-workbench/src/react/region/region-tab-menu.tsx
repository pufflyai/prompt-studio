import { Menu, Portal, type UseMenuReturn, VisuallyHidden } from "@chakra-ui/react";
import { type ResourceContextAction, ResourceMenuItems } from "@pstdio/ui";
import { useId, useRef } from "react";
import type { WorkbenchCore, WorkbenchTabMenuGroup, WorkbenchWidgetPlacement } from "../../core";
import { findPlacementByWidgetId } from "../../core/registries/layout/layout-operations";
import { useWorkbenchResourceActionResolver } from "../menus/resource-actions";
import { createWorkbenchResourceMenu } from "../menus/resource-menu";
import { WorkbenchIcon } from "../shared/icon";
import { getPanelLabel } from "./panel-widget-open";

interface RegionTabMenuProps {
  menu: UseMenuReturn;
  label: string;
  groups: readonly WorkbenchTabMenuGroup[];
  placement: WorkbenchWidgetPlacement;
  workbench: WorkbenchCore;
}
export const RegionTabMenu = (props: RegionTabMenuProps) => {
  const { menu, label, groups, placement, workbench } = props;
  const labelId = useId();
  useWorkbenchResourceActionResolver(workbench);
  const pending = useRef<ResourceContextAction | null>(null);
  const { projectId, activePageId, location } = workbench.pages.store.getState();
  const pageChoiceTarget =
    projectId && activePageId && location?.resource
      ? { projectId, pageId: activePageId, resource: location.resource }
      : undefined;
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
    ...(pageChoiceTarget
      ? [
          tabAction("reset-page-choices", "Reset page choices", "RotateCcw", () =>
            workbench.resetPageChoices(pageChoiceTarget),
          ),
        ]
      : []),
    tabAction("reset-panel-layout", "Reset panel layout", "RotateCcw", () => workbench.resetPanelLayout()),
  ];
  return (
    <Menu.RootProvider
      value={menu}
      lazyMount
      unmountOnExit
      onExitComplete={() => {
        const action = pending.current;
        pending.current = null;
        if (action) {
          const triggerId = menu.api.getTriggerProps().id;
          if (triggerId) document.getElementById(triggerId)?.focus({ preventScroll: true });
        }
        void action?.onClick?.();
      }}
    >
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-labelledby={labelId}>
            <VisuallyHidden id={labelId}>{label} context menu</VisuallyHidden>
            <ResourceMenuItems
              actions={actions}
              onSelect={(action) => {
                pending.current = action;
              }}
            />
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.RootProvider>
  );
};
