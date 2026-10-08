import { isLocalizedString } from "@pstdio/sdk/extensions";
import { type AttributeDescriptor, KanbanRenderer } from "@pstdio/ui/kanban-renderer";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { buildTicketAttributes } from "./data/mappers";

const meta: Meta<typeof KanbanRenderer> = {
  title: "Extensions/Planner/Ticket Archive Filter",
  component: KanbanRenderer,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof meta>;

const attributes = JSON.parse(JSON.stringify(buildTicketAttributes([])), (_key, value) =>
  isLocalizedString(value) ? value.default : value,
) as AttributeDescriptor[];

const archiveFilterStory = (state: "active" | "archived") =>
  ({
    args: {
      storageKey: `storybook-ticket-archive-${state}`,
      attributes,
      rows: [
        { id: "active", title: "Active ticket", attributes: { archived: "active" } },
        { id: "archived", title: "Archived ticket", attributes: { archived: "archived" } },
      ],
      defaultSettings: { viewMode: "list", columnGrouping: "none" },
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      const body = within(canvasElement.ownerDocument.body);
      await userEvent.click(canvas.getByRole("button", { name: "Filter" }));
      await userEvent.click(body.getByRole("button", { name: "Ticket" }));
      await userEvent.click(body.getByRole("checkbox", { name: state === "active" ? "Active" : "Archived" }));
      await userEvent.keyboard("{Escape}");
      const filter = canvas.getByRole("group", { name: "Ticket filter" });
      await expect(filter).toHaveTextContent(`Ticketis${state === "active" ? "Active" : "Archived"}`);
    },
  }) satisfies Story;

export const Active = archiveFilterStory("active");
export const Archived = archiveFilterStory("archived");
