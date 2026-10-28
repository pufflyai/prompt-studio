import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { WorkspaceBadge } from "@/components/primitives/workspace-badge";
import { KanbanRendererCard } from "./kanban-renderer-card";

const meta: CanvasMeta<typeof KanbanRendererCard> = {
  title: "Patterns/Kanban Renderer/Card",
  component: KanbanRendererCard,
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
type Story = CanvasVariant<typeof KanbanRendererCard>;
export const Default: Story = {
  id: "patterns-kanban-renderer-card--default",
  args: { title: "Implement user authentication flow" },
};
export const Selected: Story = {
  id: "patterns-kanban-renderer-card--selected",
  args: { title: "Implement user authentication flow", isSelected: true },
};
export const WithSingleBadge: Story = {
  id: "patterns-kanban-renderer-card--with-single-badge",
  args: {
    title: "Fix login redirect loop",
    badges: [{ attributeId: "labels", label: "bug", color: "red" }],
  },
};
export const WithMultipleBadges: Story = {
  id: "patterns-kanban-renderer-card--with-multiple-badges",
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
  id: "patterns-kanban-renderer-card--with-workspace-badge",
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
  id: "patterns-kanban-renderer-card--workspace-badge-as-display-tag",
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
  id: "patterns-kanban-renderer-card--long-title",
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
  id: "patterns-kanban-renderer-card--no-badges",
  args: { title: "Quick typo fix in README" },
};
export const WithDiffBadge: Story = {
  id: "patterns-kanban-renderer-card--with-diff-badge",
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
  id: "patterns-kanban-renderer-card--draggable",
  args: {
    title: "Drag me around",
    draggable: true,
    badges: [{ attributeId: "status", label: "todo", color: "gray" }],
  },
};
