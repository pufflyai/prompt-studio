import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HarnessCard } from "./harness-card";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta: Meta<typeof HarnessCard> = {
  title: "ProjectSettings/HarnessCard",
  component: HarnessCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Box maxWidth="720px">
          <Story />
        </Box>
      </QueryClientProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof HarnessCard>;

const baseProps = {
  agentId: "claude-code",
  name: "Claude Code",
  isInstalled: true,
  isEnabled: true,
  binaryPath: "/usr/local/bin/claude-code",
  isMutating: false,
  onToggleEnabled: () => undefined,
  onAddManually: () => undefined,
};

export const Installed: Story = {
  args: baseProps,
};

export const NotInstalledWithManualAdd: Story = {
  args: {
    ...baseProps,
    isInstalled: false,
    isEnabled: false,
    binaryPath: undefined,
  },
};

export const EnabledButNotInstalled: Story = {
  args: {
    ...baseProps,
    isInstalled: false,
    binaryPath: "/usr/local/bin/missing-binary",
  },
};

export const Multiple: Story = {
  render: () => (
    <Stack gap="md">
      <HarnessCard {...baseProps} />
      <HarnessCard {...baseProps} agentId="opencode" name="Opencode" binaryPath="/usr/local/bin/opencode" />
      <HarnessCard
        {...baseProps}
        agentId="codex"
        name="Codex"
        isInstalled={false}
        isEnabled={false}
        binaryPath={undefined}
      />
    </Stack>
  ),
};
