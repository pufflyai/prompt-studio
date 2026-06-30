import { Box, VStack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { WorkspaceBadge } from "@/components/primitives/workspace-badge";

const meta: Meta<typeof WorkspaceBadge> = {
  title: "Components/Data Display/Workspace Badge",
  component: WorkspaceBadge,
  args: {
    workspaceType: "worktree",
  },
  decorators: [
    (Story) => (
      <Box p="sm">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof WorkspaceBadge>;

export const Initializing: Story = {
  args: {
    initializing: true,
    shorthand: "A1",
  },
};

export const SingleWorkspaceNoShorthand: Story = {
  args: {
    workspaceType: "current_branch",
    sessionStatus: "in_progress",
    hasMultipleWorkspaces: false,
  },
};

export const MultiWorkspaceWithShorthandAndDropdown: Story = {
  args: {
    shorthand: "A2",
    hasMultipleWorkspaces: true,
    attemptStatus: {
      name: "Needs Review",
      color: "orange",
      description: "Waiting for reviewer confirmation",
    },
  },
};

export const WithDiffs: Story = {
  args: {
    shorthand: "A3",
    diffAdditions: 18,
    diffDeletions: 4,
    sessionStatus: "completed",
  },
};

export const WithNameAndDiffs: Story = {
  args: {
    label: "Latest implementation attempt",
    shorthand: "PS-412_A3",
    diffAdditions: 18,
    diffDeletions: 4,
    showLeadingSessionIndicator: false,
  },
};

export const LongWorkspaceName: Story = {
  args: {
    label: "Refactor workspace badge rendering for long ticket board names",
    shorthand: "PS-412_A4",
    diffAdditions: 106,
    diffDeletions: 27,
    showLeadingSessionIndicator: false,
  },
};

export const NamedMultipleWorkspaces: Story = {
  args: {
    label: "Current branch review pass",
    workspaceType: "current_branch",
    shorthand: "PS-412_A5",
    hasMultipleWorkspaces: true,
    diffAdditions: 3,
    diffDeletions: 1,
    showLeadingSessionIndicator: false,
  },
};

export const WithoutDiffs: Story = {
  args: {
    shorthand: "A3",
    sessionStatus: "completed",
  },
};

export const WithAttemptStatus: Story = {
  args: {
    shorthand: "A4",
    attemptStatus: {
      name: "Blocked",
      color: "red",
      description: "Waiting on upstream migration",
    },
    sessionStatus: "in_progress",
  },
};

export const FallbackSessionStatus: Story = {
  args: {
    shorthand: "A4",
    sessionStatus: "awaiting_input",
    attemptStatus: undefined,
  },
};

export const StateMatrix: Story = {
  render: () => (
    <VStack align="start" gap="sm">
      <WorkspaceBadge workspaceType="worktree" initializing shorthand="A1" />
      <WorkspaceBadge workspaceType="worktree" shorthand="A2" sessionStatus="in_progress" hasMultipleWorkspaces />
      <WorkspaceBadge
        workspaceType="current_branch"
        shorthand="A3"
        attemptStatus={{ name: "Ready", color: "green", description: "Ready to merge" }}
        diffAdditions={9}
        diffDeletions={2}
      />
      <WorkspaceBadge workspaceType="worktree" sessionStatus="failed" />
    </VStack>
  ),
};
