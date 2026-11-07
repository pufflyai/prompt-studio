import { type UseMenuReturn, VisuallyHidden } from "@chakra-ui/react";
import {
  ScopedMenu as Menu,
  Portal,
  type ResourceContextAction,
  ResourceMenuItems,
  useScopedMenu,
  useUiScope,
} from "@pstdio/ui";
import { useEffectEvent, useId, useLayoutEffect, useRef } from "react";
import type { WorkbenchCore, WorkbenchTabMenuGroup, WorkbenchWidgetPlacement } from "../../core";
import { findPlacementByWidgetId } from "../../core/registries/layout/layout-operations";
import { useWorkbenchResourceActionResolver } from "../menus/resource-actions";
import { createWorkbenchResourceMenu } from "../menus/resource-menu";
import { WorkbenchIcon } from "../shared/icon";
import { getPanelLabel } from "./panel-widget-open";
import type { TabContextMenu } from "./use-tab-context-menu";

interface RegionTabMenuProps {
  menu: TabContextMenu;
  label: string;
  groups: readonly WorkbenchTabMenuGroup[];
  placement: WorkbenchWidgetPlacement;
  workbench: WorkbenchCore;
}
export const RegionTabMenu = (props: RegionTabMenuProps) => {
  return props.menu.state ? <RegionTabMenuMachine {...props} /> : null;
};

const RegionTabMenuMachine = (props: RegionTabMenuProps) => {
  const { menu: controller } = props;
  const menu = useScopedMenu({
    ids: { contextTrigger: controller.triggerId },
    positioning: { placement: "bottom-start", getAnchorRect: controller.getAnchorRect, offset: { mainAxis: 0 } },
    onEscapeKeyDown: controller.onEscapeKeyDown,
    onOpenChange: controller.onOpenChange,
  });
  const triggerProps = menu.api.getContextTriggerProps();
  useLayoutEffect(() => controller.onTriggerPropsChange(triggerProps));
  const publish = controller.onTriggerPropsChange;
  useLayoutEffect(() => () => publish(null), [publish]);
  const sendOpening = useEffectEvent((point: { x: number; y: number }) => {
    menu.service.send({ type: "CONTEXT_MENU", point });
    controller.onOpeningSent();
  });
  const opening = controller.state?.opening;
  useLayoutEffect(() => {
    if (opening) sendOpening(opening);
  }, [opening]);
  return <RegionTabMenuContent {...props} menu={menu} />;
};

const RegionTabMenuContent = (props: Omit<RegionTabMenuProps, "menu"> & { menu: UseMenuReturn }) => {
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
  const actions = [
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
