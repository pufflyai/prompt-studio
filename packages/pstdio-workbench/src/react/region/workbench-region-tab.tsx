import { Box, CloseButton, Tabs, Text } from "@chakra-ui/react";
import { DropIndicator } from "@pstdio/ui";
import { WorkbenchIcon } from "../shared/icon";
import { RegionTabMenu } from "./region-tab-menu";
import { resolveTabIconName } from "./region-tabs-visibility";
import { useRegionTab, type WorkbenchRegionTabProps } from "./use-region-tab";

const TabIcon = (props: { indicator?: import("../../core").WorkbenchTabSnapshot["indicator"]; icon?: string }) => {
  const { indicator, icon } = props;
  if (indicator)
    return (
      <WorkbenchIcon
        name={indicator.icon}
        size={12}
        flexShrink={0}
        color={indicator.color ?? "fg.muted"}
        aria-label={indicator.label}
      />
    );
  return icon ? <WorkbenchIcon name={icon} size={12} flexShrink={0} color="fg.muted" /> : null;
};

export const WorkbenchRegionTab = (props: WorkbenchRegionTabProps) => {
  const { workbench, placement, activeWidgetId, disabled = false, sortable = false } = props;
  const behavior = useRegionTab(props);
  const { snapshot, drag, target, drop } = behavior;
  const label = snapshot.label ?? placement.resource?.label ?? placement.title ?? placement.contributionId;
  const labelId = `workbench-tab-label-${placement.widgetId}`;
  const widget = workbench.layout.getWidget(placement.contributionId);
  const icon =
    snapshot.icon ??
    resolveTabIconName(
      placement,
      widget,
      placement.resource ? workbench.resources.getKind(placement.resource.type)?.icon : undefined,
    );
  const active = placement.widgetId === activeWidgetId;
  return (
    <>
      <Box
        ref={(node: HTMLDivElement | null) => {
          drag.setNodeRef(node);
          target.setNodeRef(node);
        }}
        position="relative"
        data-workbench-tab={placement.widgetId}
        minW={placement.closable ? "tab-min" : undefined}
        flex={placement.closable ? "1 1 0" : "0 0 auto"}
        maxW="fit-content"
        className="group"
      >
        <Tabs.Trigger
          value={placement.widgetId}
          title={label}
          aria-labelledby={labelId}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={behavior.open}
          aria-keyshortcuts={sortable ? "Alt+ArrowLeft Alt+ArrowRight Shift+F10" : "Shift+F10"}
          fontStyle={placement.tabRetention === "preview" ? "italic" : undefined}
          opacity={drag.isDragging ? 0.5 : undefined}
          w="full"
          {...drag.listeners}
          onKeyDown={behavior.onKeyDown}
          onContextMenu={behavior.onContextMenu}
          onPointerDown={behavior.onPointerDown}
          onPointerMove={behavior.onPointerMove}
          onPointerUp={behavior.onPointerUp}
          onPointerCancel={behavior.onPointerCancel}
          onClickCapture={behavior.onClick}
        >
          <TabIcon indicator={snapshot.indicator} icon={icon} />
          <Text as="span" id={labelId} data-tab-label>
            {label}
          </Text>
          {placement.closable ? (
            <CloseButton
              as="span"
              role="button"
              aria-label={`Close ${label}`}
              aria-disabled={disabled}
              data-tab-close
              size="2xs"
              boxSize="4"
              minW="4"
              p="0"
              borderRadius="2xs"
              flexShrink={0}
              me="-1"
              opacity={active ? 1 : 0}
              pointerEvents={active ? "auto" : "none"}
              color="fg.muted"
              _groupHover={{ opacity: 1, pointerEvents: "auto" }}
              _groupFocusWithin={{ opacity: 1, pointerEvents: "auto" }}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (disabled) return;
                if (placement.placementIdentity) workbench.closePlacement(placement.placementIdentity);
                else workbench.layout.closePanel(placement.widgetId);
              }}
            />
          ) : null}
        </Tabs.Trigger>
        {drop ? (
          <DropIndicator
            orientation="vertical"
            left={drop.edge === "before" ? "0" : undefined}
            right={drop.edge === "after" ? "0" : undefined}
          />
        ) : null}
      </Box>
      <RegionTabMenu
        anchor={behavior.anchor}
        label={label}
        open={behavior.open}
        setOpen={behavior.setOpen}
        groups={snapshot.menu ?? []}
        placement={placement}
        workbench={workbench}
      />
    </>
  );
};
