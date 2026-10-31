import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { CircleAlert, CircleCheck, CircleDashed, CircleDot, CircleX, Play, Signal } from "lucide-react";
import { useState } from "react";
import { KanbanRendererList, type KanbanRendererListItem } from "./kanban-renderer-list";

const meta: CanvasMeta<typeof KanbanRendererList> = {
  title: "Patterns/Kanban Renderer/List",
  component: KanbanRendererList,
};
export default meta;
type Story = CanvasFrame<typeof KanbanRendererList>;
const mockItems: KanbanRendererListItem[] = [
  {
    id: "1",
    title: "Review workspace onboarding",
    statusIcon: Signal,
    statusColor: "fg.muted",
    badges: [{ attributeId: "updated", label: "Jan 21" }],
    contextMenuActions: [{ key: "run", label: "Run attempt", icon: <Play size={14} />, onClick: () => undefined }],
  },
  {
    id: "7",
    title: "Initial worktree setup",
    statusIcon: CircleDashed,
    badges: [{ attributeId: "updated", label: "Feb 17" }],
  },
  {
    id: "8",
    title: "I am parent!",
    statusIcon: CircleX,
    statusColor: "fg.error",
    countBadge: 2,
    countColorPalette: "red",
    badges: [{ attributeId: "updated", label: "Feb 17" }],
    children: [
      {
        id: "9",
        title: "child task",
        statusIcon: CircleDashed,
        badges: [{ attributeId: "updated", label: "Feb 18" }],
      },
      {
        id: "10",
        title: "another child",
        statusIcon: CircleDashed,
        badges: [{ attributeId: "updated", label: "Mar 7" }],
      },
    ],
  },
  {
    id: "2",
    title: "Set up your teams",
    statusIcon: CircleCheck,
    statusColor: "fg.success",
    badges: [{ attributeId: "updated", label: "Jan 21" }],
  },
  {
    id: "5",
    title: "Add label support",
    statusIcon: CircleCheck,
    statusColor: "fg.success",
    badges: [
      { attributeId: "labels", label: "test", color: "purple" },
      { attributeId: "updated", label: "Feb 6" },
    ],
  },
];
export const Default: Story = {
  id: "patterns-kanban-renderer-list--default",
  args: { items: mockItems },
};
const InteractiveWrapper = () => {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <KanbanRendererList items={mockItems} selectedItemId={selected} onItemClick={(item) => setSelected(item.id)} />
  );
};
export const Interactive: Story = {
  id: "patterns-kanban-renderer-list--interactive",
  render: () => <InteractiveWrapper />,
};
export const WithBadges: Story = {
  id: "patterns-kanban-renderer-list--with-badges",
  args: {
    items: [
      {
        id: "1",
        title: "Implement authentication flow",
        statusIcon: CircleDot,
        statusColor: "fg.success",
        badges: [
          { attributeId: "priority", label: "high", color: "red", icon: "alert-triangle" },
          { attributeId: "component", label: "backend", color: "blue", icon: "tag" },
        ],
      },
      {
        id: "2",
        title: "Fix login redirect loop",
        statusIcon: CircleAlert,
        statusColor: "fg.error",
        badges: [{ attributeId: "labels", label: "bug", color: "red", icon: "bug" }],
      },
    ],
  },
};
export const Empty: Story = {
  id: "patterns-kanban-renderer-list--empty",
  args: { items: [] },
};
export const DeepNesting: Story = {
  id: "patterns-kanban-renderer-list--deep-nesting",
  args: {
    items: [
      {
        id: "p1",
        title: "Top-level parent",
        statusIcon: CircleDashed,
        children: [
          {
            id: "c1",
            title: "Child task",
            statusIcon: CircleDashed,
            children: [
              {
                id: "gc1",
                title: "Grandchild task",
                statusIcon: CircleCheck,
                statusColor: "fg.success",
              },
            ],
          },
          { id: "c2", title: "Another child", statusIcon: CircleDashed },
        ],
      },
    ],
  },
};
const largeItems: KanbanRendererListItem[] = Array.from({ length: 1000 }, (_, index) => ({
  id: `row-${index}`,
  eyebrow: `PS-${index + 1}`,
  title: `Ticket ${index + 1}`,
  statusIcon: CircleDashed,
  badges: [{ attributeId: "updated", label: "Oct 19" }],
  contextMenuActions: [{ key: "open", label: "Open ticket", onClick: () => undefined }],
}));
// A long list mounts the rows near the viewport, so opening 1,000 tickets stays fast.
export const LargeList: Story = {
  id: "patterns-kanban-renderer-list--large-list",
  args: { items: largeItems },
  decorators: [
    (Story) => (
      <Box height="600px" display="flex" flexDirection="column">
        <Story />
      </Box>
    ),
  ],
};
