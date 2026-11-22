import { Box, IconButton } from "@chakra-ui/react";
import {
  BubbleButton,
  PANEL_HEADER_CONTROL_SIZE,
  type ResourceContextAction,
  ResourceContextMenu,
  Tooltip,
} from "@pstdio/ui";
import type { RefObject } from "react";
import { WorkbenchIcon } from "../../react/shared/icon";

interface PanelMenuOpenerProps {
  title: string;
  icon: string;
  open: boolean;
  onToggle: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  controls?: string;
  id?: string;
  actions?: ResourceContextAction[];
  floating?: boolean;
}

// Same control sizing, icon, spacing and tooltip as WorkbenchPanelMenuOpener.
// Only the prototype's local open-state binding differs from the live workbench.
export const PanelMenuOpener = (props: PanelMenuOpenerProps) => {
  const { title, icon, open, onToggle, buttonRef, controls, id, actions = [], floating = false } = props;
  return (
    <ResourceContextMenu actions={actions}>
      <Box display="flex">
        {floating ? (
          <BubbleButton
            id={id}
            ref={buttonRef}
            tooltip={title}
            aria-label={`${open ? "Close" : "Open"} ${title}`}
            aria-expanded={open}
            aria-controls={controls}
            aria-pressed={open}
            onClick={onToggle}
            containerProps={{ position: "relative", bottom: "auto", right: "auto" }}
          >
            <WorkbenchIcon name={icon} size={14} />
          </BubbleButton>
        ) : (
          <Tooltip content={title}>
            <IconButton
              id={id}
              ref={buttonRef}
              variant="ghost"
              size={PANEL_HEADER_CONTROL_SIZE}
              aria-label={`${open ? "Close" : "Open"} ${title}`}
              aria-expanded={open}
              aria-controls={controls}
              flexShrink={0}
              onClick={onToggle}
            >
              <WorkbenchIcon name={icon} size={14} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </ResourceContextMenu>
  );
};
