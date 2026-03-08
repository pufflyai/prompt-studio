import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import type { AgentConfig, AgentInfo } from "@/features/agents/types";
import { Settings } from "./settings-index";

const agentInfos: AgentInfo[] = [
  { id: "claude-code", name: "Claude Code", availability: { type: "INSTALLED" } },
  { id: "opencode", name: "OpenCode", availability: { type: "INSTALLED" } },
  { id: "codex", name: "Codex", availability: { type: "NOT_FOUND" } },
];

const agentConfigs: AgentConfig[] = [
  {
    id: "1",
    agent_id: "claude-code",
    is_default: true,
    config: "{}",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const createMockQueryClient = () => {
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

  queryClient.setQueryData(["agents", "info"], agentInfos);
  queryClient.setQueryData(["agents", "configs"], agentConfigs);

  return queryClient;
};

const SettingsStory = () => {
  const [queryClient] = useState(createMockQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <Box bg="background.primary" minH="100vh">
        <Settings />
      </Box>
    </QueryClientProvider>
  );
};

const meta: Meta = {
  title: "Settings/SettingsPage",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => <SettingsStory />,
};

const createEmptyQueryClient = () => {
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

  queryClient.setQueryData(["agents", "info"], []);
  queryClient.setQueryData(["agents", "configs"], []);

  return queryClient;
};

const EmptyStory = () => {
  const [queryClient] = useState(createEmptyQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <Box bg="background.primary" minH="100vh">
        <Settings />
      </Box>
    </QueryClientProvider>
  );
};

export const Empty: Story = {
  render: () => <EmptyStory />,
};
