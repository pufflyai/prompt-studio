import { Box, CloseButton, Tabs, Text, useTabsContext } from "@chakra-ui/react";
import { DropIndicator, PaletteShortcut, Tooltip } from "@pstdio/ui";
import { type ReactElement, type RefObject, useRef } from "react";
import { runUserAction } from "../../core/shared/run-user-action";
import { ActivityDot } from "../resource-changes/activity-dot";
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
        role={indicator.label ? "img" : undefined}
        aria-label={indicator.label}
        aria-hidden={indicator.label ? undefined : true}
      />
    );
  return icon ? <WorkbenchIcon name={icon} size={12} flexShrink={0} color="fg.muted" /> : null;
};

const RegionTabTooltip = (props: {
  label: string;
  detail?: string;
  labelRef: RefObject<HTMLSpanElement | null>;
  children: ReactElement;
}) => {
  const { label, detail, labelRef, children } = props;
  const content = detail ? (
    <>
      <Text>{label}</Text>
      <Text>{detail}</Text>
    </>
  ) : (
    label
  );
  return (
    <Tooltip
      content={content}
      overflowRef={detail ? undefined : labelRef}
      closeDelay={150}
      positioning={{ placement: "bottom" }}
    >
      {children}
    </Tooltip>
  );
};

export const WorkbenchRegionTab = (props: WorkbenchRegionTabProps) => {
  const { workbench, placement, activeWidgetId, disabled = false, sortable = false } = props;
  const tabs = useTabsContext();
  const triggerId = tabs.getTriggerProps({ value: placement.widgetId }).id!;
  const behavior = useRegionTab(props, triggerId);
  const { snapshot, drag, target, drop } = behavior;
  const label = snapshot.label ?? placement.resource?.label ?? placement.title ?? placement.contributionId;
  const labelId = `workbench-tab-label-${placement.widgetId}`;
  const labelRef = useRef<HTMLSpanElement>(null);
  const widget = workbench.layout.getWidget(placement.contributionId);
  const icon =
    placement.resource?.icon ??
    snapshot.icon ??
    resolveTabIconName(
      placement,
      widget,
      placement.resource
        ? workbench.resources.getKind(placement.resource.type, placement.resource.extensionId)?.icon
        : undefined,
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
        <RegionTabTooltip label={label} detail={snapshot.tooltip} labelRef={labelRef}>
          <Tabs.Trigger
            id={triggerId}
            value={placement.widgetId}
            aria-labelledby={labelId}
            aria-describedby={placement.resource ? `${labelId}-activity` : undefined}
            disabled={disabled}
            aria-haspopup="menu"
            aria-expanded={behavior.menu.api.open}
            data-keyboard-selected={props.keyboardSelected ? "" : undefined}
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
            {props.shortcut ? (
              <span aria-hidden="true" data-keyboard-tab-shortcut>
                <PaletteShortcut binding={props.shortcut} />
              </span>
            ) : null}
            <TabIcon
              indicator={
                snapshot.indicator ??
                (placement.resource?.icon
                  ? {
                      icon: placement.resource.icon,
                      color: placement.resource.iconColor,
                      label: placement.resource.iconLabel,
                    }
                  : undefined)
              }
              icon={icon}
            />
            <Text asChild>
              <span ref={labelRef} id={labelId} data-tab-label>
                {label}
              </span>
            </Text>
            {placement.resource ? (
              <ActivityDot id={`${labelId}-activity`} workbench={workbench} resource={placement.resource} />
            ) : null}
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
                  const identity = placement.placementIdentity;
                  if (identity) void runUserAction(workbench, "Close tab", () => workbench.closePlacement(identity));
                  else workbench.layout.closePanel(placement.widgetId);
                }}
              />
            ) : null}
          </Tabs.Trigger>
        </RegionTabTooltip>
        <TabDropIndicator drop={drop} />
      </Box>
      <RegionTabMenu
        menu={behavior.menu}
        label={label}
        groups={snapshot.menu ?? []}
        placement={placement}
        workbench={workbench}
      />
    </>
  );
};

const TabDropIndicator = (props: { drop: ReturnType<typeof useRegionTab>["drop"] }) => {
  const { drop } = props;
  if (!drop) return null;
  return (
    <DropIndicator
      orientation="vertical"
      left={drop.edge === "before" ? "0" : undefined}
      right={drop.edge === "after" ? "0" : undefined}
    />
  );
};
