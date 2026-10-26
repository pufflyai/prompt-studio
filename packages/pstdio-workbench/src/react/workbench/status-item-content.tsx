import { Box, Popover, Portal } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchWidgetHost } from "../region/widget-host";

export const StatusItemContent = (props: {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  visible: boolean;
}) => {
  const { workbench, placement, visible } = props;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);
  const item = workbench.statusBar.getItem(placement.widgetId);
  const trigger = <WorkbenchWidgetHost workbench={workbench} region="status" placement={placement} />;
  if (!item?.popoverViewId) return trigger;
  const detail = {
    ...placement,
    widgetId: JSON.stringify(["status-popover", placement.widgetId]),
    contributionId: item.popoverViewId,
    viewId: item.popoverViewId,
    title: workbench.views.getView(item.popoverViewId)?.title,
  };
  return (
    <Popover.Root
      open={visible && open}
      onOpenChange={(event) => setOpen(event.open)}
      lazyMount
      unmountOnExit
      positioning={{ placement: item.slot === "trailing" ? "top-end" : "top-start", offset: { mainAxis: 4 } }}
    >
      <Popover.Trigger asChild>
        <Box
          display="flex"
          minW="0"
          role="button"
          tabIndex={0}
          aria-label={placement.title}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
            event.preventDefault();
            setOpen((current) => !current);
          }}
        >
          {trigger}
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            aria-label={detail.title}
            width="performance-popover"
            maxW="calc(100vw - var(--chakra-spacing-md) * 2)"
            maxH="70dvh"
            overflow="hidden"
          >
            <Popover.Body minH="0" display="flex" flexDirection="column">
              <ScrollArea minH="0">
                <WorkbenchWidgetHost workbench={workbench} region="main" placement={detail} sizing="content-height" />
              </ScrollArea>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
