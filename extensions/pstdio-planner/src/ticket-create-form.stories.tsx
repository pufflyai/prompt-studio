import { KanbanRendererCreateDialog } from "@pstdio/ui/kanban-renderer";
import type { Meta, StoryObj } from "@storybook/react";
import { createTicketFormConfig } from "./ticket-create-form";

const meta: Meta<typeof KanbanRendererCreateDialog> = {
  title: "Extensions/Planner/Shared Ticket Form",
  component: KanbanRendererCreateDialog,
};
export default meta;
type Story = StoryObj<typeof meta>;
export const NewTicket: Story = {
  args: {
    open: true,
    columnId: "ready",
    columnAttributeId: "status",
    attributes: [
      {
        id: "status",
        label: "Status",
        editable: true,
        type: { kind: "enum", options: [{ value: "ready", label: "Ready", icon: "circle" }] },
      },
    ],
    config: createTicketFormConfig((_key, fallback) => fallback ?? ""),
    onClose: () => {},
    onSubmit: () => {},
  },
};
