import { CloseButton, Menu, Portal, Tabs, Text } from "@chakra-ui/react";
import { type MouseEvent as ReactMouseEvent, type ReactNode, useState } from "react";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchRegionTabProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  activeWidgetId: string | undefined;
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

export const WorkbenchRegionTab = (props: WorkbenchRegionTabProps) => {
  const { activeWidgetId, placement, workbench } = props;
  const closable = placement.closable === true;
  const isActive = placement.widgetId === activeWidgetId;
  const label = placement.title ?? placement.contributionId;
  const widget = workbench.layout.getWidget(placement.contributionId);
  const icon =
    placement.resource?.icon ??
    (placement.resource ? workbench.resources.getKind(placement.resource.kind)?.icon : undefined) ??
    widget?.icon;
  const contentRendererId = placement.tab?.contentRendererId;
  const contextMenuRendererId = placement.tab?.contextMenuRendererId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const openContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (!contextMenuRendererId) return;

    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    setMenuOpen(true);
  };
  const trigger = (
    <Tabs.Trigger
      value={placement.widgetId}
      maxW="12rem"
      minW="0"
      flexShrink={0}
      title={label}
      className="group"
      onContextMenu={contextMenuRendererId ? openContextMenu : undefined}
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
            workbench.layout.closeWidget(placement.widgetId);
          }}
        />
      ) : null}
    </Tabs.Trigger>
  );

  if (!contextMenuRendererId) return trigger;

  return (
    <>
      {trigger}
      <Menu.Root
        open={menuOpen}
        onOpenChange={(details) => setMenuOpen(details.open)}
        positioning={{ placement: "bottom-start", getAnchorRect: () => anchor, offset: { mainAxis: 0 } }}
      >
        <Portal>
          <Menu.Positioner>
            <Menu.Content aria-label={`${label} actions`} minW="18.75rem" bg="bg">
              <WorkbenchTabRenderer workbench={workbench} placement={placement} rendererId={contextMenuRendererId} />
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </>
  );
};
