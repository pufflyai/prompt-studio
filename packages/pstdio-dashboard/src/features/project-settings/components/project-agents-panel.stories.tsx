import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AgentInfo } from "@/features/agents/types";
import { ProjectAgentsPanelView } from "./project-agents-panel-view";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const modelsByAgent = {
  "claude-code": [{ id: "claude-3-5-sonnet" }, { id: "claude-3-7-sonnet" }],
  opencode: [{ id: "openai/gpt-5.1" }, { id: "anthropic/claude-sonnet-4.5" }],
  fake: [],
};

const meta: Meta<typeof ProjectAgentsPanelView> = {
  title: "ProjectSettings/ProjectAgentsPanel",
  component: ProjectAgentsPanelView,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Box maxWidth="640px">
          <Story />
        </Box>
      </QueryClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ProjectAgentsPanelView>;

const installed = (id: string, name: string): AgentInfo => ({
  id,
  name,
  availability: { type: "INSTALLED" },
});

const enabledAgents = [
  installed("claude-code", "Claude Code"),
  installed("opencode", "Opencode"),
  installed("fake", "Fake Agent"),
];

Object.entries(modelsByAgent).forEach(([agentId, models]) => {
  queryClient.setQueryData(["agent-models", agentId], models);
});

export const NoDefaultSelectedUsesAgentDefault: Story = {
  args: {
    enabledAgentIds: ["claude-code", "opencode"],
    agents: enabledAgents,
    defaultAgentId: null,
    defaultAgentModel: null,
    isUpdating: false,
    updateFailureCount: 0,
    onSetDefaultAgent: () => {},
  },
};

export const ClaudeCodeIsDefault: Story = {
  args: {
    enabledAgentIds: ["claude-code", "opencode"],
    agents: enabledAgents,
    defaultAgentId: "claude-code",
    defaultAgentModel: "claude-3-5-sonnet",
    isUpdating: false,
    updateFailureCount: 0,
    onSetDefaultAgent: () => {},
  },
};

export const DefaultPointsAtMissingAgent: Story = {
  args: {
    enabledAgentIds: ["opencode"],
    agents: enabledAgents,
    defaultAgentId: "claude-code",
    defaultAgentModel: null,
    isUpdating: false,
    updateFailureCount: 0,
    onSetDefaultAgent: () => {},
  },
};

export const DefaultAgentHasNoModels: Story = {
  args: {
    enabledAgentIds: ["fake", "opencode"],
    agents: enabledAgents,
    defaultAgentId: "fake",
    defaultAgentModel: null,
    isUpdating: false,
    updateFailureCount: 0,
    onSetDefaultAgent: () => {},
  },
};

export const NoEnabledAgents: Story = {
  args: {
    enabledAgentIds: ["custom-agent"],
    agents: [],
    defaultAgentId: null,
    defaultAgentModel: null,
    isUpdating: false,
    updateFailureCount: 0,
    onSetDefaultAgent: () => {},
  },
};
