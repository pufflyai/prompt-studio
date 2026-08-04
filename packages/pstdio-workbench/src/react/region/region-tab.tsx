import { CloseButton, Menu, Portal, Tabs, Text } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListRow } from "@pstdio/ui";
import { type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, useState } from "react";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { toPanelContribution, toPanelInstance } from "../../core/registries/layout/panel-api";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchRegionTabProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  activeWidgetId: string | undefined;
  disabled?: boolean;
  nextWidgetId?: string;
  previousWidgetId?: string;
  sortable?: boolean;
}

const noopRefresh = () => undefined;

const WorkbenchTabRenderer = (props: {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  rendererId: string;
}) => {
  const { placement, rendererId, workbench } = props;
  const widget = workbench.layout.getWidget(placement.contributionId);
  const renderer = useWorkbenchStore(workbench.renderers.store, (state) => state.renderers[rendererId]);

  if (!widget || !renderer || renderer.keepAlive) return null;
  return renderer.render({
    workbench,
    panel: toPanelContribution(widget),
    instance: toPanelInstance(placement),
    refresh: noopRefresh,
  }) as ReactNode;
};

const useRegionTabBehavior = (input: WorkbenchRegionTabProps) => {
  const { disabled = false, nextWidgetId, placement, previousWidgetId, sortable = false, workbench } = input;
  const customMenuRendererId = placement.tab?.customMenuRendererId;
  const isPreview = placement.tabRetention === "preview";
  const hasCustomMenu = Boolean(customMenuRendererId);
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
    customMenuRendererId,
    hasCustomMenu,
    hasContextMenu,
    isPreview,
    openContextMenu,
    openCustomMenu,
    openMenu,
    reorderWithKeyboard,
    setMenuOpen,
    sortableState,
  };
};

const WorkbenchRegionTabMenuSurface = (props: {
  anchor: { x: number; y: number; width: number; height: number };
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
  anchor: { x: number; y: number; width: number; height: number };
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
          onActivate={() =>
            workbench.layout.updatePanel(placement.widgetId, {
              strategy: { kind: "persistent" },
            })
          }
        />
      </Menu.Item>
    </WorkbenchRegionTabMenuSurface>
  );
};

const WorkbenchRegionTabLabel = (props: {
  contentRendererId?: string;
  icon?: string;
  label: string;
  placement: WorkbenchWidgetPlacement;
  workbench: WorkbenchCore;
}) => {
  const { contentRendererId, icon, label, placement, workbench } = props;
  if (contentRendererId) {
    return <WorkbenchTabRenderer workbench={workbench} placement={placement} rendererId={contentRendererId} />;
  }
  return (
    <>
      {icon ? <WorkbenchIcon name={icon} size={12} flexShrink={0} color="fg.muted" /> : null}
      <Text as="span" minW="0" truncate>
        {label}
      </Text>
    </>
  );
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
      {behavior.customMenuRendererId ? (
        <WorkbenchRegionTabMenuSurface
          anchor={behavior.anchor}
          label={`${label} menu`}
          open={behavior.openMenu === "custom"}
          setMenuOpen={(open) => behavior.setMenuOpen("custom", open)}
        >
          <WorkbenchTabRenderer
            workbench={workbench}
            placement={placement}
            rendererId={behavior.customMenuRendererId}
          />
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
  const label = placement.title ?? placement.contributionId;
  const widget = workbench.layout.getWidget(placement.contributionId);
  const icon =
    placement.resource?.icon ??
    (placement.resource ? workbench.resources.getKind(placement.resource.kind)?.icon : undefined) ??
    widget?.icon;
  const contentRendererId = placement.tab?.contentRendererId;
  const behavior = useRegionTabBehavior(props);
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
          contentRendererId={contentRendererId}
          icon={icon}
          label={label}
          placement={placement}
          workbench={workbench}
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
