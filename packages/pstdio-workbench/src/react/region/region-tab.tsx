import { Box, CloseButton, Menu, Portal, Tabs, Text } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListRow } from "@pstdio/ui";
import { type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchTabMenuGroup, WorkbenchTabSnapshot, WorkbenchWidgetPlacement } from "../../core";
import { toPanelInstance } from "../../core/registries/layout/panel-api";
import { WorkbenchIcon } from "../shared/icon";
import { resolveTabIconName } from "./region-tabs-visibility";

interface WorkbenchRegionTabProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  activeWidgetId: string | undefined;
  disabled?: boolean;
  nextWidgetId?: string;
  previousWidgetId?: string;
  sortable?: boolean;
}
const useTabSnapshot = (placement: WorkbenchWidgetPlacement): WorkbenchTabSnapshot => {
  const tab = placement.tab;
  const [, setVersion] = useState(0);
  useEffect(() => {
    const subscription = tab?.subscribe?.(() => setVersion((version) => version + 1));
    if (!subscription) return undefined;
    return typeof subscription === "function" ? subscription : () => subscription.dispose();
  }, [tab]);
  return tab?.getSnapshot(toPanelInstance(placement)) ?? {};
};
const useRegionTabBehavior = (input: WorkbenchRegionTabProps, tabSnapshot: WorkbenchTabSnapshot) => {
  const { disabled = false, nextWidgetId, placement, previousWidgetId, sortable = false, workbench } = input;
  const isPreview = placement.tabRetention === "preview";
  const hasCustomMenu = Boolean(tabSnapshot.menu?.some((group) => group.rows.length > 0));
  const hasContextMenu = isPreview;
  const sortableState = useSortable({ id: placement.widgetId, disabled: disabled || !sortable });
  const [openMenu, setOpenMenu] = useState<"custom" | "context">();
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const openTabMenu = (menu: "custom" | "context", event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    setOpenMenu(menu);
  };
  const openCustomMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (hasCustomMenu && !disabled) openTabMenu("custom", event);
  };
  const openContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (hasContextMenu && !disabled) openTabMenu("context", event);
  };
  const setMenuOpen = (menu: "custom" | "context", open: boolean) => {
    setOpenMenu((current) => (open ? menu : current === menu ? undefined : current));
  };
  const reorderWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!sortable || disabled || !event.altKey) return;
    if (event.key === "ArrowLeft" && previousWidgetId) {
      event.preventDefault();
      workbench.layout.reorderPanel(placement.widgetId, { beforeWidgetId: previousWidgetId });
    }
    if (event.key === "ArrowRight" && nextWidgetId) {
      event.preventDefault();
      workbench.layout.reorderPanel(placement.widgetId, { afterWidgetId: nextWidgetId });
    }
  };
  return {
    anchor,
    hasCustomMenu,
    hasContextMenu,
    isPreview,
    openContextMenu,
    openCustomMenu,
    openMenu,
    reorderWithKeyboard,
    setMenuOpen,
    sortableState,
    tabSnapshot,
  };
};
const WorkbenchRegionTabMenuSurface = (props: {
  anchor: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children: ReactNode;
  label: string;
  open: boolean;
  setMenuOpen(open: boolean): void;
}) => {
  const { anchor, children, label, open, setMenuOpen } = props;
  return (
    <Menu.Root
      open={open}
      onOpenChange={(details) => setMenuOpen(details.open)}
      positioning={{ placement: "bottom-start", getAnchorRect: () => anchor, offset: { mainAxis: 0 } }}
    >
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label={label} minW="18.75rem" bg="bg">
            {children}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
const WorkbenchRegionTabContextMenu = (props: {
  anchor: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label: string;
  open: boolean;
  placement: WorkbenchWidgetPlacement;
  setMenuOpen(open: boolean): void;
  workbench: WorkbenchCore;
}) => {
  const { anchor, label, open, placement, setMenuOpen, workbench } = props;
  return (
    <WorkbenchRegionTabMenuSurface
      anchor={anchor}
      label={`${label} context menu`}
      open={open}
      setMenuOpen={setMenuOpen}
    >
      <Menu.Item value="keep-open" asChild>
        <ListRow
          asChild
          variant="full-width"
          id="keep-open"
          label="Keep Open"
          icon={<WorkbenchIcon name="pin" size={14} />}
          onActivate={() => {
            if (placement.placementIdentity) workbench.pinPlacement(placement.placementIdentity);
            else workbench.layout.updatePanel(placement.widgetId, { strategy: { kind: "persistent" } });
          }}
        />
      </Menu.Item>
    </WorkbenchRegionTabMenuSurface>
  );
};
const WorkbenchRegionTabLabel = (props: {
  icon?: string;
  indicator?: WorkbenchTabSnapshot["indicator"];
  id: string;
  label: string;
}) => {
  const { icon, id, indicator, label } = props;
  return (
    <>
      {indicator ? (
        <WorkbenchIcon
          name={indicator.icon}
          size={12}
          flexShrink={0}
          color={indicator.color ?? "fg.muted"}
          aria-label={indicator.label}
        />
      ) : icon ? (
        <WorkbenchIcon name={icon} size={12} flexShrink={0} color="fg.muted" />
      ) : null}
      <Text as="span" id={id} minW="0" truncate>
        {label}
      </Text>
    </>
  );
};
const activateTabAction = (
  workbench: WorkbenchCore,
  action: NonNullable<WorkbenchTabMenuGroup["rows"][number]["action"]>,
) => {
  if (action.kind === "command") {
    void workbench.commands.executeCommand(action.commandId, action.args);
    return;
  }
  void workbench.navigation.openTarget(action.target);
};
const WorkbenchStructuredTabMenu = (props: { groups: readonly WorkbenchTabMenuGroup[]; workbench: WorkbenchCore }) => {
  const { groups, workbench } = props;
  return groups.map((group, groupIndex) => (
    <Box key={group.id} display="contents">
      {groupIndex > 0 ? <Menu.Separator /> : null}
      {group.rows.map((row) => (
        <Menu.Item key={row.id} value={row.id} disabled={row.disabled} asChild>
          <ListRow
            asChild
            variant="full-width"
            id={row.id}
            label={row.label}
            icon={row.icon ? <WorkbenchIcon name={row.icon} size={16} /> : undefined}
            iconColor={row.iconColor}
            isSelected={row.selected}
            disabled={row.disabled}
            onActivate={row.action ? () => activateTabAction(workbench, row.action!) : undefined}
          />
        </Menu.Item>
      ))}
    </Box>
  ));
};
const WorkbenchRegionTabCloseButton = (props: {
  disabled: boolean;
  isActive: boolean;
  label: string;
  placement: WorkbenchWidgetPlacement;
  workbench: WorkbenchCore;
}) => {
  const { disabled, isActive, label, placement, workbench } = props;
  if (placement.closable !== true) return null;
  return (
    <CloseButton
      as="span"
      role="button"
      aria-label={`Close ${label}`}
      aria-disabled={disabled}
      size="2xs"
      boxSize="1rem"
      minW="1rem"
      p="0"
      borderRadius="2xs"
      flexShrink={0}
      me="-1"
      opacity={isActive ? "1" : "0"}
      pointerEvents={isActive ? "auto" : "none"}
      color="fg.muted"
      _groupHover={{ opacity: "1", pointerEvents: "auto" }}
      _groupFocusWithin={{ opacity: "1", pointerEvents: "auto" }}
      _hover={{ bg: "transparent", color: "fg" }}
      _active={{ bg: "transparent" }}
      transition="opacity 120ms ease"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) return;
        const identity = placement.placementIdentity;
        if (identity) {
          workbench.closePlacement(identity);
          return;
        }
        workbench.layout.closePanel(placement.widgetId);
      }}
    />
  );
};
const WorkbenchRegionTabMenus = (props: {
  behavior: ReturnType<typeof useRegionTabBehavior>;
  label: string;
  placement: WorkbenchWidgetPlacement;
  workbench: WorkbenchCore;
}) => {
  const { behavior, label, placement, workbench } = props;
  return (
    <>
      {behavior.hasCustomMenu ? (
        <WorkbenchRegionTabMenuSurface
          anchor={behavior.anchor}
          label={`${label} menu`}
          open={behavior.openMenu === "custom"}
          setMenuOpen={(open) => behavior.setMenuOpen("custom", open)}
        >
          <WorkbenchStructuredTabMenu groups={behavior.tabSnapshot.menu ?? []} workbench={workbench} />
        </WorkbenchRegionTabMenuSurface>
      ) : null}
      {behavior.hasContextMenu ? (
        <WorkbenchRegionTabContextMenu
          anchor={behavior.anchor}
          label={label}
          open={behavior.openMenu === "context"}
          placement={placement}
          setMenuOpen={(open) => behavior.setMenuOpen("context", open)}
          workbench={workbench}
        />
      ) : null}
    </>
  );
};
export const WorkbenchRegionTab = (props: WorkbenchRegionTabProps) => {
  const { activeWidgetId, disabled = false, placement, sortable = false, workbench } = props;
  const isActive = placement.widgetId === activeWidgetId;
  const tabSnapshot = useTabSnapshot(placement);
  const label = tabSnapshot.label ?? placement.resource?.label ?? placement.title ?? placement.contributionId;
  const labelId = `workbench-tab-label-${placement.widgetId}`;
  const widget = workbench.layout.getWidget(placement.contributionId);
  const icon = resolveTabIconName(
    placement,
    widget,
    placement.resource ? workbench.resources.getKind(placement.resource.type)?.icon : undefined,
  );
  const behavior = useRegionTabBehavior(props, tabSnapshot);
  const { isDragging, listeners, setNodeRef, transform, transition } = behavior.sortableState;
  const menuOpen =
    (behavior.openMenu === "custom" && behavior.hasCustomMenu) ||
    (behavior.openMenu === "context" && behavior.hasContextMenu);
  return (
    <>
      <Tabs.Trigger
        ref={setNodeRef}
        value={placement.widgetId}
        maxW="12rem"
        minW="0"
        flexShrink={0}
        title={label}
        // Name the tab from its label element alone. Computing the name from the tab's
        // contents would fold in the nested Close button, so a closable tab would be
        // called "Artifacts Close Artifacts" and rename itself the moment it became
        // closable. The label element still carries any status or count a tab renders.
        aria-labelledby={labelId}
        disabled={disabled}
        className="group"
        aria-haspopup={behavior.hasCustomMenu || behavior.hasContextMenu ? "menu" : undefined}
        aria-expanded={behavior.hasCustomMenu || behavior.hasContextMenu ? menuOpen : undefined}
        aria-keyshortcuts={sortable ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
        fontStyle={behavior.isPreview ? "italic" : undefined}
        opacity={isDragging ? "0.5" : undefined}
        transform={CSS.Transform.toString(transform)}
        transition={transition}
        {...listeners}
        onKeyDown={behavior.reorderWithKeyboard}
        onContextMenu={behavior.hasContextMenu ? behavior.openContextMenu : undefined}
        onClick={behavior.hasCustomMenu && isActive && !disabled ? behavior.openCustomMenu : undefined}
      >
        <WorkbenchRegionTabLabel
          icon={tabSnapshot.icon ?? icon}
          id={labelId}
          indicator={tabSnapshot.indicator}
          label={label}
        />
        <WorkbenchRegionTabCloseButton
          disabled={disabled}
          isActive={isActive}
          label={label}
          placement={placement}
          workbench={workbench}
        />
      </Tabs.Trigger>
      <WorkbenchRegionTabMenus behavior={behavior} label={label} placement={placement} workbench={workbench} />
    </>
  );
};
