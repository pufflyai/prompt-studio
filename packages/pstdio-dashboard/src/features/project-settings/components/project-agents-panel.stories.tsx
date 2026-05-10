import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AgentInfo } from "@/features/agents/types";
import { ProjectAgentsPanelView } from "./project-agents-panel-view";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta: Meta<typeof ProjectAgentsPanelView> = {
  title: "ProjectSettings/ProjectDefaultHarnessPanel",
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

export const NoDefaultSelected: Story = {
  args: {
    enabledAgentIds: ["claude-code", "opencode"],
    agents: enabledAgents,
    defaultAgentId: null,
    defaultAgentModel: null,
    isUpdating: false,
    onSetDefaultAgent: () => {},
    onSetDefaultModel: () => {},
  },
};

export const OneEnabledHarnessNoDefaultSelected: Story = {
  args: {
    enabledAgentIds: ["claude-code"],
    agents: enabledAgents,
    defaultAgentId: null,
    defaultAgentModel: null,
    isUpdating: false,
    onSetDefaultAgent: () => {},
    onSetDefaultModel: () => {},
  },
};

export const DefaultHarnessWithModel: Story = {
  args: {
    enabledAgentIds: ["claude-code", "opencode"],
    agents: enabledAgents,
    defaultAgentId: "claude-code",
    defaultAgentModel: "claude-3-5-sonnet",
    isUpdating: false,
    onSetDefaultAgent: () => {},
    onSetDefaultModel: () => {},
  },
};

export const DefaultHarnessWithHarnessDefaultModel: Story = {
  args: {
    enabledAgentIds: ["claude-code", "opencode"],
    agents: enabledAgents,
    defaultAgentId: "opencode",
    defaultAgentModel: null,
    isUpdating: false,
    onSetDefaultAgent: () => {},
    onSetDefaultModel: () => {},
  },
};

export const StaleDefaultHarnessWarning: Story = {
  args: {
    enabledAgentIds: ["opencode"],
    agents: enabledAgents,
    defaultAgentId: "claude-code",
    defaultAgentModel: null,
    isUpdating: false,
    onSetDefaultAgent: () => {},
    onSetDefaultModel: () => {},
  },
};

export const StaleDefaultHarnessWarningNoEnabledHarnesses: Story = {
  args: {
    enabledAgentIds: ["custom-agent"],
    agents: enabledAgents,
    defaultAgentId: "claude-code",
    defaultAgentModel: null,
    isUpdating: false,
    onSetDefaultAgent: () => {},
    onSetDefaultModel: () => {},
  },
};

export const NoEnabledAgents: Story = {
  args: {
    enabledAgentIds: ["custom-agent"],
    agents: [],
    defaultAgentId: null,
    defaultAgentModel: null,
    isUpdating: false,
    onSetDefaultAgent: () => {},
    onSetDefaultModel: () => {},
  },
};
