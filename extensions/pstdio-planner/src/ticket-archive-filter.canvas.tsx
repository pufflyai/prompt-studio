import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { isLocalizedString } from "@pstdio/sdk/extensions";
import { type AttributeDescriptor, KanbanRenderer } from "@pstdio/ui/kanban-renderer";
import { buildTicketAttributes } from "./data/mappers";

const meta: CanvasMeta<typeof KanbanRenderer> = {
  title: "Extensions/Planner/Ticket Archive Filter",
  component: KanbanRenderer,
  fullscreen: true,
};
export default meta;
type Story = CanvasFrame<typeof meta>;
const attributes = JSON.parse(JSON.stringify(buildTicketAttributes([])), (_key, value) =>
  isLocalizedString(value) ? value.default : value,
) as AttributeDescriptor[];
const archiveFilterStory = (state: "active" | "archived") =>
  ({
    args: {
      storageKey: `preview-ticket-archive-${state}`,
      attributes,
      rows: [
        { id: "active", title: "Active ticket", attributes: { archived: "active" } },
        { id: "archived", title: "Archived ticket", attributes: { archived: "archived" } },
      ],
      defaultSettings: { viewMode: "list", columnGrouping: "none" },
    },
  }) satisfies Story;
export const Active = {
  id: "extensions-planner-ticket-archive-filter--active",
  ...archiveFilterStory("active"),
};
export const Archived = {
  id: "extensions-planner-ticket-archive-filter--archived",
  ...archiveFilterStory("archived"),
};
