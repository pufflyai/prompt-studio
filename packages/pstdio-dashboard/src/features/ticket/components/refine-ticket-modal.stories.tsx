import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { agentModelKeys } from "@/features/agents/hooks/use-agent-models";
import { agentKeys } from "@/features/agents/hooks/use-agents";
import { WorkspaceProvider } from "@/features/workspaces/state";
import { RefineTicketModal } from "./refine-ticket-modal";

const createQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });

  queryClient.setQueryData(agentKeys.list(), [
    {
      id: "opencode",
      name: "Opencode",
      availability: { type: "INSTALLED" },
      capabilities: [],
      isDefault: true,
    },
    {
      id: "claude-code",
      name: "Claude Code",
      availability: { type: "INSTALLED" },
      capabilities: [],
      isDefault: false,
    },
  ]);

  queryClient.setQueryData(agentModelKeys.byAgent("opencode"), [{ id: "o3" }, { id: "gpt-5" }]);
  queryClient.setQueryData(agentModelKeys.byAgent("claude-code"), [{ id: "sonnet-4" }]);

  return queryClient;
};

const RefineTicketModalStory = (props: {
  ticketShorthand: string;
  isSubmitting?: boolean;
  templates?: Array<{ id: string; name: string }>;
}) => {
  const { ticketShorthand, isSubmitting = false, templates = [] } = props;
  const [queryClient] = useState(createQueryClient);
  const [open, setOpen] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
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
