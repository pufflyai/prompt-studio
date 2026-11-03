import { Box, Button } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Info } from "lucide-react";
import { Tooltip } from "@/components/primitives/tooltip";
import { ResourceContextMenu } from "./resource-context-menu";

const reason = "Stop active or queued work before deleting.";
const Preview = () => (
  <ResourceContextMenu
    actions={[
      { key: "rename", label: "Rename session" },
      {
        key: "delete",
        label: "Delete session",
        isDisabled: true,
        endContent: (
          <Tooltip content={reason}>
            <Box as="span" tabIndex={0} aria-label={reason}>
              <Info size={14} />
            </Box>
          </Tooltip>
        ),
      },
    ]}
  >
    <Button variant="subtle">Session actions</Button>
  </ResourceContextMenu>
);
export default {
  title: "Proposals/PS-1049 Keyboard help for unavailable actions",
  component: Preview,
  description:
    "Open Session actions with the context-menu gesture. Tab focuses the existing Info explanation without activating Delete. The next Tab leaves; Escape closes the menu. No new control or appearance is introduced.",
} satisfies CanvasMeta;
export const UnavailableAction: CanvasFrame = { id: "proposals-ps1049-unavailable-action" };
