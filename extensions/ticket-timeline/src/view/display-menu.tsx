// Group the timeline's display options in one popover, like the host's Kanban and data table views.
import { Icon, IconButton, Popover, Portal } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DisplaySettings } from "../contracts";
import { SectionLabel, ToggleRow } from "./display-controls";

interface DisplayMenuProps {
  display: DisplaySettings;
  onChange: (change: Partial<DisplaySettings>) => void;
}

// Menus inside the popover render in their own layer, so an outside click is checked by hand.
function useOutsideClose(open: boolean, setOpen: (open: boolean) => void) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !contentRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, setOpen]);

  return { triggerRef, contentRef };
}

export function DisplayMenu(props: DisplayMenuProps) {
  const { display, onChange } = props;
  const [open, setOpen] = useState(false);
  const { triggerRef, contentRef } = useOutsideClose(open, setOpen);
  return (
    <Popover.Root
      open={open}
      closeOnInteractOutside={false}
      positioning={{ placement: "bottom-end", offset: { mainAxis: 8 }, getAnchorElement: () => triggerRef.current }}
      onOpenChange={(details) => setOpen(details.open)}
    >
      <Tooltip content="Display">
        <Popover.Trigger asChild>
          <IconButton ref={triggerRef} aria-label="Display settings" variant="ghost" size="2xs">
            <Icon as={Settings2} />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content ref={contentRef} width="18.75rem" padding="xs" gap="1px">
            <SectionLabel>SHOW</SectionLabel>
            <ToggleRow
              label="Done tickets"
              checked={display.showDone}
              onChange={(showDone) => onChange({ showDone })}
            />
            <ToggleRow
              label="Completed past deadlines"
              checked={display.showCompletedPastDeadlines}
              onChange={(showCompletedPastDeadlines) => onChange({ showCompletedPastDeadlines })}
            />
            <ToggleRow
              label="Only work that needs attention"
              checked={display.attentionOnly}
              onChange={(attentionOnly) => onChange({ attentionOnly })}
            />
            <SectionLabel>ARROWS</SectionLabel>
            <ToggleRow
              label="Square arrows"
              checked={display.squareArrows}
              onChange={(squareArrows) => onChange({ squareArrows })}
            />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
