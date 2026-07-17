import { CloseButton, Tabs, Text } from "@chakra-ui/react";
import type { MouseEventHandler } from "react";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchIcon } from "../shared/icon";

interface AreaTabTriggerProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  activeWidgetId?: string;
  onContextMenu?: MouseEventHandler<HTMLElement>;
}

export const isPlacementCloseable = (placement: WorkbenchWidgetPlacement) => placement.closable === true;

export const AreaTabTrigger = (props: AreaTabTriggerProps) => {
  const { workbench, placement, activeWidgetId, onContextMenu } = props;
  const closable = isPlacementCloseable(placement);
  const isActive = placement.widgetId === activeWidgetId;
  const label = placement.title ?? placement.contributionId;
  const icon =
    placement.resource?.icon ??
    (placement.resource ? workbench.resources.getKind(placement.resource.kind)?.icon : undefined);

  return (
    <Tabs.Trigger
      value={placement.widgetId}
      h="1.25rem"
      maxW="12rem"
      minW="0"
      flexShrink={0}
      gap="2xs"
      px="xs"
      py="0"
      borderRadius="2xs"
      borderWidth="1px"
      borderColor="border.subtle"
      textStyle="label/XS/medium"
      title={label}
      className="group"
      _selected={{ color: "fg", borderColor: "border.subtle" }}
      _hover={isActive ? undefined : { bg: "bg.hover", borderColor: "border.subtle", color: "fg" }}
      onContextMenu={onContextMenu}
    >
      {icon ? <WorkbenchIcon name={icon} size={12} flexShrink={0} color="fg.muted" /> : null}
      <Text as="span" minW="0" truncate>
        {label}
      </Text>
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
};
