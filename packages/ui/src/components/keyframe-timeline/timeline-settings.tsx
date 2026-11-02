import { IconButton } from "@chakra-ui/react";
import { Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { ScopedPopover as Popover } from "../../utils/scoped-overlays";
import { Portal } from "../../utils/ui-scope";
import { ScrollArea } from "../primitives/scroll-area";
import { Tooltip } from "../primitives/tooltip";

export const TimelineSettings = (props: { children: ReactNode }) => (
  <Popover.Root positioning={{ placement: "top-end" }}>
    <Tooltip content="Animation settings">
      <Popover.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label="Animation settings">
          <Settings2 />
        </IconButton>
      </Popover.Trigger>
    </Tooltip>
    <Portal>
      <Popover.Positioner>
        <Popover.Content aria-label="Animation settings" w="xs" maxW="90vw" maxH="60vh">
          <ScrollArea minH="0">
            <Popover.Body>{props.children}</Popover.Body>
          </ScrollArea>
        </Popover.Content>
      </Popover.Positioner>
    </Portal>
  </Popover.Root>
);
