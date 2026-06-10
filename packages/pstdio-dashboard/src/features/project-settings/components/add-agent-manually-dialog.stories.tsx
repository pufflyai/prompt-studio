import type { Meta, StoryObj } from "@storybook/react";
import { AddAgentManuallyDialog } from "./add-agent-manually-dialog";

const meta: Meta<typeof AddAgentManuallyDialog> = {
  title: "ProjectSettings/AddAgentManuallyDialog",
  component: AddAgentManuallyDialog,
  parameters: { layout: "centered" },
};

export default meta;

type Story = StoryObj<typeof AddAgentManuallyDialog>;

const baseProps = {
  open: true,
  isSubmitting: false,
  onClose: () => undefined,
  onCreate: async () => undefined,
};

export const WithAvailableHarnesses: Story = {
  args: {
    ...baseProps,
    availableAgents: [
      { id: "pstdio.pstdio-claude-code.claude-code", name: "Claude Code" },
      { id: "pstdio.pstdio-opencode.opencode", name: "OpenCode" },
      { id: "acme.acme-agent.my-agent", name: "My Agent" },
    ],
  },
};

export const Submitting: Story = {
  args: {
    ...baseProps,
    isSubmitting: true,
    availableAgents: [{ id: "pstdio.pstdio-claude-code.claude-code", name: "Claude Code" }],
  },
};
