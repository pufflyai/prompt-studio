import { type UseMenuReturn, VisuallyHidden } from "@chakra-ui/react";
import { ScopedMenu as Menu, Portal, type ResourceContextAction, ResourceMenuItems, useUiScope } from "@pstdio/ui";
import { useId, useRef, useSyncExternalStore } from "react";
import type { WorkbenchCore, WorkbenchTabMenuGroup, WorkbenchWidgetPlacement } from "../../core";
import { findPlacementByWidgetId } from "../../core/registries/layout/layout-operations";
import { createTabWindowTarget, type WorkbenchWindowHost } from "../../core/windows/workbench-windows";
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
const noWindows: readonly never[] = [];
const noSubscription = () => () => {};

// PS-1128 prototype: other windows the tab can move to. Empty when the host has one window.
const useWindowTargets = (host: WorkbenchWindowHost | undefined) =>
  useSyncExternalStore(host?.subscribe ?? noSubscription, () => host?.getTargets() ?? noWindows);

export const RegionTabMenu = (props: RegionTabMenuProps) => {
  const { menu, label, groups, placement, workbench } = props;
  const labelId = useId();
  useWorkbenchResourceActionResolver(workbench);
  const root = useUiScope()?.root;
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
  const windowHost = workbench.windows;
  const windowTargets = useWindowTargets(windowHost);
  const windowTarget = windowHost ? createTabWindowTarget(workbench, placement) : undefined;
  // The tab leaves this window only after the other window accepted it.
  const moveToWindow = (windowId?: string) => {
    if (!windowHost || !windowTarget) return;
    void windowHost.moveTab(windowTarget, windowId).then(close);
  };
  const tabAction = (
    key: string,
    title: string,
    icon: string,
    action: Pick<ResourceContextAction, "onClick" | "onSelect">,
  ) => ({
    key,
    label: title,
    icon: <WorkbenchIcon name={icon} size={14} />,
    group: { id: "tab", label: "Tab" },
    ...action,
  });
  const windowAction = (key: string, title: string, icon: string, windowId?: string) => ({
    key,
    label: title,
    icon: <WorkbenchIcon name={icon} size={14} />,
    group: { id: "window", label: "Window" },
    onClick: () => moveToWindow(windowId),
  });
  const actions = [
    ...(windowTarget
      ? [
          windowAction("move-new-window", "Move to new window", "AppWindow"),
          ...windowTargets.map((target) =>
            windowAction(`move-window-${target.id}`, `Move to ${target.label}`, "AppWindowMac", target.id),
          ),
        ]
      : []),
    ...createWorkbenchResourceMenu(workbench, placement.resource, { menu: groups }, placement),
    ...(placement.tabRetention
      ? [tabAction("pin", placement.tabRetention === "preview" ? "Pin tab" : "Unpin tab", "pin", { onSelect: pin })]
      : []),
    ...destinations.map((region) =>
      tabAction(`move-${region}`, `Move to ${getPanelLabel(region)}`, "ArrowRight", {
        onClick: () => workbench.movePanel(placement.widgetId, region),
      }),
    ),
    ...(placement.closable ? [tabAction("close", "Close tab", "x", { onClick: close })] : []),
    tabAction("reset-layout", "Reset layout", "RotateCcw", { onClick: () => workbench.resetLayout() }),
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
          const contentId = menu.api.getContentProps().id;
          const content = contentId
            ? (root?.current ?? document).querySelector<HTMLElement>(`#${CSS.escape(contentId)}`)
            : null;
          const focused = document.activeElement;
          // A newer menu or input keeps the focus it received while this menu was closing.
          if (focused === document.body || content?.contains(focused)) {
            const triggerId = menu.api.getContextTriggerProps().id;
            if (triggerId)
              (root?.current ?? document)
                .querySelector<HTMLElement>(`#${CSS.escape(triggerId)}`)
                ?.focus({ preventScroll: true });
          }
        }
        void action?.onClick?.();
      }}
    >
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-labelledby={labelId}>
            <VisuallyHidden id={labelId}>{label} context menu</VisuallyHidden>
            {menu.api.open ? (
              <ResourceMenuItems
                actions={actions}
                onSelect={(action) => {
                  pending.current = action;
                  void action.onSelect?.();
                }}
              />
            ) : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.RootProvider>
  );
};
