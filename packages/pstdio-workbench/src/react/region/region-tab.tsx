import { CloseButton, Menu, Portal, Tabs, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
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
  const trigger = (
    <Tabs.Trigger
      value={placement.widgetId}
      h="1.5rem"
      maxW="12rem"
      minW="0"
      flexShrink={0}
      gap="2xs"
      px="xs"
      py="0"
      borderRadius="xs"
      borderWidth="1px"
      borderColor="border.subtle"
      textStyle="label/XS/medium"
      title={label}
      className="group"
      _selected={{ color: "fg", borderColor: "border.subtle" }}
      _hover={isActive ? undefined : { bg: "bg.hover", borderColor: "border.subtle", color: "fg" }}
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
    <Menu.Root positioning={{ placement: "bottom-start" }}>
      <Menu.ContextTrigger asChild>{trigger}</Menu.ContextTrigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label={`${label} actions`} minW="18.75rem" bg="bg">
            <WorkbenchTabRenderer workbench={workbench} placement={placement} rendererId={contextMenuRendererId} />
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
