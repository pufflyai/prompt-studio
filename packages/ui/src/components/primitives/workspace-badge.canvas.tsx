import { Box, VStack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { WorkspaceBadge } from "@/components/primitives/workspace-badge";

const meta: CanvasMeta<typeof WorkspaceBadge> = {
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
type Story = CanvasVariant<typeof WorkspaceBadge>;
export const ProjectFolder: Story = {
  id: "components-data-display-workspace-badge--project-folder",
  args: {
    workspaceType: "folder",
    label: "Project workspace",
    sessionStatus: "in_progress",
  },
};
export const GitWorktree: Story = {
  id: "components-data-display-workspace-badge--git-worktree",
  args: {
    workspaceType: "worktree",
    shorthand: "PS-412_A1",
    diffAdditions: 18,
    diffDeletions: 4,
  },
};
export const RemoteWorkspace: Story = {
  id: "components-data-display-workspace-badge--remote-workspace",
  args: {
    workspaceType: "remote",
    label: "Cloud development",
    sessionStatus: "completed",
  },
};
export const Initializing: Story = {
  id: "components-data-display-workspace-badge--initializing",
  args: {
    initializing: true,
    shorthand: "A1",
  },
};
export const SingleWorkspaceNoShorthand: Story = {
  id: "components-data-display-workspace-badge--single-workspace-no-shorthand",
  args: {
    workspaceType: "folder",
    sessionStatus: "in_progress",
    hasMultipleWorkspaces: false,
  },
};
export const MultiWorkspaceWithShorthandAndDropdown: Story = {
  id: "components-data-display-workspace-badge--multi-workspace-with-shorthand-and-dropdown",
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
  id: "components-data-display-workspace-badge--with-diffs",
  args: {
    shorthand: "A3",
    diffAdditions: 18,
    diffDeletions: 4,
    sessionStatus: "completed",
  },
};
export const WithNameAndDiffs: Story = {
  id: "components-data-display-workspace-badge--with-name-and-diffs",
  args: {
    label: "Latest implementation attempt",
    shorthand: "PS-412_A3",
    diffAdditions: 18,
    diffDeletions: 4,
    showLeadingSessionIndicator: false,
  },
};
export const LongWorkspaceName: Story = {
  id: "components-data-display-workspace-badge--long-workspace-name",
  args: {
    label: "Refactor workspace badge rendering for long ticket board names",
    shorthand: "PS-412_A4",
    diffAdditions: 106,
    diffDeletions: 27,
    showLeadingSessionIndicator: false,
  },
};
export const NamedMultipleWorkspaces: Story = {
  id: "components-data-display-workspace-badge--named-multiple-workspaces",
  args: {
    label: "Remote review pass",
    workspaceType: "remote",
    shorthand: "PS-412_A5",
    hasMultipleWorkspaces: true,
    showLeadingSessionIndicator: false,
  },
};
export const WithoutDiffs: Story = {
  id: "components-data-display-workspace-badge--without-diffs",
  args: {
    shorthand: "A3",
    sessionStatus: "completed",
  },
};
export const WithAttemptStatus: Story = {
  id: "components-data-display-workspace-badge--with-attempt-status",
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
  id: "components-data-display-workspace-badge--fallback-session-status",
  args: {
    shorthand: "A4",
    sessionStatus: "awaiting_input",
    attemptStatus: undefined,
  },
};
export const StateMatrix: Story = {
  id: "components-data-display-workspace-badge--state-matrix",
  render: () => (
    <VStack align="start" gap="sm">
      <WorkspaceBadge workspaceType="worktree" initializing shorthand="A1" />
      <WorkspaceBadge workspaceType="worktree" shorthand="A2" sessionStatus="in_progress" hasMultipleWorkspaces />
      <WorkspaceBadge
        workspaceType="worktree"
        shorthand="A3"
        attemptStatus={{ name: "Ready", color: "green", description: "Ready to merge" }}
        diffAdditions={9}
        diffDeletions={2}
      />
      <WorkspaceBadge workspaceType="worktree" sessionStatus="failed" />
      <WorkspaceBadge workspaceType="folder" label="Project workspace" sessionStatus="in_progress" />
      <WorkspaceBadge workspaceType="remote" label="Cloud development" sessionStatus="completed" />
    </VStack>
  ),
};
