import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { KanbanRendererCreateDialog } from "@pstdio/ui/kanban-renderer";
import { createTicketFormConfig } from "./ticket-create-form";

const meta: CanvasMeta<typeof KanbanRendererCreateDialog> = {
  title: "Extensions/Planner/Shared Ticket Form",
  component: KanbanRendererCreateDialog,
};
export default meta;
type Story = CanvasVariant<typeof meta>;
export const NewTicket: Story = {
  id: "extensions-planner-shared-ticket-form--new-ticket",
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
