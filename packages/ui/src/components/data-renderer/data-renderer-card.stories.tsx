import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";

import { WorkspaceBadge } from "../workspace-badge";
import { DataRendererCard } from "./data-renderer-card";

const meta: Meta<typeof DataRendererCard> = {
  title: "Patterns/Data Renderer/Card",
  component: DataRendererCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Box maxWidth="300px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DataRendererCard>;

export const Default: Story = {
  args: { title: "Implement user authentication flow" },
};

export const Selected: Story = {
  args: { title: "Implement user authentication flow", isSelected: true },
};

export const WithSingleBadge: Story = {
  args: {
    title: "Fix login redirect loop",
    badges: [{ attributeId: "labels", label: "bug", color: "red" }],
  },
};

export const WithMultipleBadges: Story = {
  args: {
    title: "Add dark mode support to settings panel",
    badges: [
      { attributeId: "status", label: "in progress", color: "yellow" },
      { attributeId: "priority", label: "high", color: "red" },
      { attributeId: "component", label: "frontend", color: "purple" },
    ],
  },
};

export const WithWorkspaceBadge: Story = {
  args: {
    title: "Create API endpoint for user preferences",
    workspaceBadge: { workspaceType: "worktree", shorthand: "A1", sessionStatus: "completed" },
    badges: [
      { attributeId: "component", label: "backend", color: "blue" },
      { attributeId: "status", label: "todo", color: "gray" },
    ],
  },
};

export const WorkspaceBadgeAsDisplayTag: Story = {
  args: {
    title: "Create API endpoint for user preferences",
    customSlots: [
      <WorkspaceBadge
        key="workspace"
        workspaceType="worktree"
        shorthand="A2"
        diffAdditions={12}
        diffDeletions={4}
        hasMultipleWorkspaces
        showLeadingSessionIndicator={false}
      />,
    ],
    badges: [
      { attributeId: "component", label: "backend", color: "blue" },
      { attributeId: "status", label: "todo", color: "gray" },
    ],
  },
};

export const LongTitle: Story = {
  args: {
    title:
      "Refactor the entire authentication module to support OAuth2 and SAML providers with backward-compatible session handling",
    badges: [
      { attributeId: "type", label: "refactor", color: "purple" },
      { attributeId: "priority", label: "high", color: "red" },
    ],
  },
};

export const NoBadges: Story = {
  args: { title: "Quick typo fix in README" },
};

export const WithDiffBadge: Story = {
  args: {
    title: "Implement card workspace shortcut",
    workspaceBadge: {
      workspaceType: "worktree",
      shorthand: "A2",
      diffAdditions: 12,
      diffDeletions: 4,
      sessionStatus: "in_progress",
    },
  },
};

export const Draggable: Story = {
  args: {
    title: "Drag me around",
    draggable: true,
    badges: [{ attributeId: "status", label: "todo", color: "gray" }],
  },
};
