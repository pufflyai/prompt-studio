import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { WorkspaceProvider } from "@/features/workspaces/state";
import { RefineTicketModal } from "./refine-ticket-modal";

const RefineTicketModalStory = (props: {
  ticketShorthand: string;
  isSubmitting?: boolean;
  templates?: Array<{ id: string; name: string }>;
}) => {
  const { ticketShorthand, isSubmitting = false, templates = [] } = props;
  const [open, setOpen] = useState(true);

  return (
    <WorkspaceProvider>
      <RefineTicketModal
        open={open}
        ticketShorthand={ticketShorthand}
        onClose={() => setOpen(false)}
        onSubmit={async () => true}
        isSubmitting={isSubmitting}
        templates={templates}
      />
    </WorkspaceProvider>
  );
};

const meta = {
  title: "Ticket/RefineTicketModal",
  component: RefineTicketModal,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof RefineTicketModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    ticketShorthand: "TK0209",
    templates: [
      { id: "template-1", name: "default-refine" },
      { id: "template-2", name: "custom-refine" },
    ],
    onClose: () => {},
    onSubmit: async () => true,
  },
  render: (args) => (
    <RefineTicketModalStory
      ticketShorthand={args.ticketShorthand}
      isSubmitting={args.isSubmitting}
      templates={args.templates}
    />
  ),
};
