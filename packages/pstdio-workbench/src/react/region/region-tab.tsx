import { CloseButton, Menu, Portal, Tabs, Text } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListRow } from "@pstdio/ui";
import { type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, useState } from "react";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
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
  return renderer.render({ workbench, widget, placement, refresh: noopRefresh }) as ReactNode;
};

const useRegionTabBehavior = (input: WorkbenchRegionTabProps) => {
  const { disabled = false, nextWidgetId, placement, previousWidgetId, sortable = false, workbench } = input;
  const contextMenuRendererId = placement.tab?.contextMenuRendererId;
  const isPreview = placement.tabRetention === "preview";
  const hasContextMenu = isPreview || Boolean(contextMenuRendererId);
  const sortableState = useSortable({ id: placement.widgetId, disabled: disabled || !sortable });
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const openTabMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (!hasContextMenu || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    setMenuOpen(true);
  };
  const reorderWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!sortable || disabled || !event.altKey) return;
    if (event.key === "ArrowLeft" && previousWidgetId) {
      event.preventDefault();
      workbench.layout.reorderWidget(placement.widgetId, { beforeWidgetId: previousWidgetId });
    }
    if (event.key === "ArrowRight" && nextWidgetId) {
      event.preventDefault();
      workbench.layout.reorderWidget(placement.widgetId, { afterWidgetId: nextWidgetId });
    }
  };
  return {
    anchor,
    contextMenuRendererId,
    hasContextMenu,
    isPreview,
    menuOpen,
    openTabMenu,
    reorderWithKeyboard,
    setMenuOpen,
    sortableState,
  };
};

const WorkbenchRegionTabMenu = (props: {
  anchor: { x: number; y: number; width: number; height: number };
  contextMenuRendererId?: string;
  isPreview: boolean;
  label: string;
  menuOpen: boolean;
  placement: WorkbenchWidgetPlacement;
  setMenuOpen(open: boolean): void;
  workbench: WorkbenchCore;
}) => {
  const { anchor, contextMenuRendererId, isPreview, label, menuOpen, placement, setMenuOpen, workbench } = props;
  return (
    <Menu.Root
      open={menuOpen}
      onOpenChange={(details) => setMenuOpen(details.open)}
      positioning={{ placement: "bottom-start", getAnchorRect: () => anchor, offset: { mainAxis: 0 } }}
    >
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label={`${label} actions`} minW="18.75rem" bg="bg">
            {isPreview ? (
              <>
                <Menu.Item value="keep-open" asChild>
                  <ListRow
                    asChild
                    variant="full-width"
                    id="keep-open"
                    label="Keep Open"
                    icon={<WorkbenchIcon name="pin" size={14} />}
                    onActivate={() =>
                      workbench.layout.updateWidgetPlacement(placement.widgetId, {
                        tabRetention: "persistent",
                      })
                    }
                  />
                </Menu.Item>
                {contextMenuRendererId ? <Menu.Separator /> : null}
              </>
            ) : null}
            {contextMenuRendererId ? (
              <WorkbenchTabRenderer workbench={workbench} placement={placement} rendererId={contextMenuRendererId} />
            ) : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export const WorkbenchRegionTab = (props: WorkbenchRegionTabProps) => {
  const { activeWidgetId, disabled = false, placement, sortable = false, workbench } = props;
  const closable = placement.closable === true;
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
  const trigger = (
    <Tabs.Trigger
      ref={setNodeRef}
      value={placement.widgetId}
      maxW="12rem"
      minW="0"
      flexShrink={0}
      title={label}
      disabled={disabled}
      className="group"
      aria-haspopup={behavior.hasContextMenu ? "menu" : undefined}
      aria-expanded={behavior.hasContextMenu ? behavior.menuOpen : undefined}
      aria-keyshortcuts={sortable ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
      fontStyle={behavior.isPreview ? "italic" : undefined}
      opacity={isDragging ? "0.5" : undefined}
      transform={CSS.Transform.toString(transform)}
      transition={transition}
      {...listeners}
      onKeyDown={behavior.reorderWithKeyboard}
      onContextMenu={behavior.hasContextMenu ? behavior.openTabMenu : undefined}
      onClick={behavior.hasContextMenu && isActive && !disabled ? behavior.openTabMenu : undefined}
    >
      {contentRendererId ? (
        <WorkbenchTabRenderer workbench={workbench} placement={placement} rendererId={contentRendererId} />
      ) : (
        <>
          {icon ? <WorkbenchIcon name={icon} size={12} flexShrink={0} color="fg.muted" /> : null}
          <Text as="span" minW="0" truncate>
            {label}
          </Text>
        </>
      )}
      {closable ? (
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
            workbench.layout.closeWidget(placement.widgetId);
          }}
        />
      ) : null}
    </Tabs.Trigger>
  );

  if (!behavior.hasContextMenu) return trigger;

  return (
    <>
      {trigger}
      <WorkbenchRegionTabMenu
        anchor={behavior.anchor}
        contextMenuRendererId={behavior.contextMenuRendererId}
        isPreview={behavior.isPreview}
        label={label}
        menuOpen={behavior.menuOpen}
        placement={placement}
        setMenuOpen={behavior.setMenuOpen}
        workbench={workbench}
      />
    </>
  );
};
