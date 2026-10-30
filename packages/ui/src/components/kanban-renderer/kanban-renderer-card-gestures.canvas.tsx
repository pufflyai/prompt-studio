import { Button } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { SessionIndicator } from "../primitives/session-indicator";
import { KanbanRendererCard } from "./kanban-renderer-card";

const meta: CanvasMeta<typeof KanbanRendererCard> = {
  title: "Patterns/Kanban Renderer/Card Gestures",
  component: KanbanRendererCard,
};
export default meta;
const openCard = () => {};
const openSession = () => {};
export const NestedControlRelease: CanvasVariant<typeof KanbanRendererCard> = {
  id: "patterns-kanban-renderer-card-gestures--nested-control-release",
  args: {
    title: "Keep the ticket board open",
    onClick: openCard,
    customSlots: [
      <Button
        key="session"
        aria-label="Open latest session"
        variant="ghost"
        size="xs"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openSession();
        }}
      >
        <SessionIndicator status="failed" ariaLabel="Latest session status" />
      </Button>,
    ],
  },
};
