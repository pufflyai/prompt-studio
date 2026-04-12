import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { WorkspaceBadge } from "./workspace-badge";

const meta: Meta<typeof WorkspaceBadge> = {
  title: "Components/WorkspaceBadge",
  component: WorkspaceBadge,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Box maxW="420px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof WorkspaceBadge>;

export const Initializing: Story = {
  args: {
    workspaceType: "worktree",
    initializing: true,
    onClick: () => undefined,
  },
};

export const SingleWorkspace: Story = {
  args: {
    workspaceType: "worktree",
    sessionStatus: "completed",
    diffAdditions: 12,
    diffDeletions: 3,
    onClick: () => undefined,
  },
};

export const MultipleWorkspaces: Story = {
  args: {
    workspaceType: "worktree",
    shorthand: "PS-34_A2",
    sessionStatus: "awaiting_input",
    attemptStatus: {
      name: "Needs Review",
      color: "orange",
      description: "Waiting for reviewer approval",
    },
    diffAdditions: 7,
    diffDeletions: 2,
    hasMultipleWorkspaces: true,
    workspaceOptions: [
      { id: "PS-34_A1", label: "PS-34_A1" },
      { id: "PS-34_A3", label: "PS-34_A3" },
    ],
    onClick: () => undefined,
    onWorkspaceOptionSelect: () => undefined,
  },
};

export const WithoutDiffAndAttemptStatus: Story = {
  args: {
    workspaceType: "current_branch",
    shorthand: "PS-34_A1",
    onClick: () => undefined,
  },
};

export const AllSessionStatuses: Story = {
  render: () => (
    <Stack gap="xs" alignItems="start">
      {(["in_progress", "awaiting_input", "completed", "failed", undefined] as const).map((status) => (
        <HStack key={status ?? "undefined"} gap="xs">
          <WorkspaceBadge
            workspaceType="worktree"
            shorthand="PS-34_A1"
            sessionStatus={status}
            onClick={() => undefined}
          />
          <Text textStyle="label/S/regular">{status ?? "undefined"}</Text>
        </HStack>
      ))}
    </Stack>
  ),
};
