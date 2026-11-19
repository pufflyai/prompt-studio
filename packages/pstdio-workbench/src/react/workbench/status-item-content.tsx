import { ScopedPopover as Popover, Portal, UiScopeActivity } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchCore, WorkbenchStatusBarSlot, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchWidgetHost } from "../region/widget-host";
import { ViewActivityContext } from "../shared/view-activity-context";

interface StatusItemPopoverProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  viewId: string;
  slot: WorkbenchStatusBarSlot;
  open: boolean;
  onOpenChange(open: boolean): void;
  children: ReactNode;
}

export const StatusItemPopover = (props: StatusItemPopoverProps) => {
  const { workbench, placement, viewId, slot, open, onOpenChange, children } = props;
  const detail = {
    ...placement,
    widgetId: JSON.stringify(["status-popover", placement.widgetId]),
    contributionId: viewId,
    viewId,
    title: workbench.views.getView(viewId)?.title,
  };
  return (
    <Popover.Root
      open={open}
      onOpenChange={(event) => onOpenChange(event.open)}
      variant="widget"
      lazyMount
      unmountOnExit={false}
      positioning={{
        placement: ({ leading: "top-start", center: "top", trailing: "top-end" } as const)[slot],
        offset: { mainAxis: 4 },
      }}
    >
      {children}
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            aria-label={detail.title}
            width="performance-popover"
            maxW="calc(100vw - var(--chakra-spacing-md) * 2)"
            maxH="70dvh"
            overflow="hidden"
          >
            {/* Give the guest one bounded viewport to measure. The frame then uses its reported height. */}
            <Popover.Body minH="0" display="flex" flexDirection="column" css={{ "& iframe": { maxHeight: "70dvh" } }}>
              <ViewActivityContext value={open}>
                <UiScopeActivity active={open}>
                  <WorkbenchWidgetHost workbench={workbench} region="main" placement={detail} sizing="bounded-height" />
                </UiScopeActivity>
              </ViewActivityContext>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
