// Group the timeline's display options in one popover, like the host's Kanban and data table views.
import { Icon, IconButton } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { ViewBarPopover } from "@pstdio/ui/collection-view";
import { CalendarCheck, CircleAlert, CircleCheck, CornerDownRight, Settings2 } from "lucide-react";
import { useRef, useState } from "react";
import type { DisplaySettings } from "../contracts";
import { SectionLabel, ToggleRow } from "./display-controls";

interface DisplayMenuProps {
  display: DisplaySettings;
  onChange: (change: Partial<DisplaySettings>) => void;
}

export function DisplayMenu(props: DisplayMenuProps) {
  const { display, onChange } = props;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Tooltip content="Display">
        <IconButton
          ref={triggerRef}
          aria-label="Display settings"
          variant="ghost"
          size="2xs"
          onClick={() => setOpen(!open)}
        >
          <Icon as={Settings2} />
        </IconButton>
      </Tooltip>
      <ViewBarPopover open={open} onOpenChange={setOpen} anchorRef={triggerRef} width="18.75rem" placement="bottom-end">
        <SectionLabel>SHOW</SectionLabel>
        <ToggleRow
          icon={CircleCheck}
          label="Done tickets"
          checked={display.showDone}
          onChange={(showDone) => onChange({ showDone })}
        />
        <ToggleRow
          icon={CalendarCheck}
          label="Completed past deadlines"
          checked={display.showCompletedPastDeadlines}
          onChange={(showCompletedPastDeadlines) => onChange({ showCompletedPastDeadlines })}
        />
        <ToggleRow
          icon={CircleAlert}
          label="Only work that needs attention"
          checked={display.attentionOnly}
          onChange={(attentionOnly) => onChange({ attentionOnly })}
        />
        <SectionLabel>ARROWS</SectionLabel>
        <ToggleRow
          icon={CornerDownRight}
          label="Square arrows"
          checked={display.squareArrows}
          onChange={(squareArrows) => onChange({ squareArrows })}
        />
      </ViewBarPopover>
    </>
  );
}
