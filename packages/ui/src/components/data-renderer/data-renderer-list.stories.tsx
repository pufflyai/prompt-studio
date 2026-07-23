import type { Meta, StoryObj } from "@storybook/react";
import { CircleAlert, CircleCheck, CircleDashed, CircleDot, CircleX, Play, Signal } from "lucide-react";
import { useState } from "react";

import { DataRendererList, type DataRendererListItem } from "./data-renderer-list";

const meta: Meta<typeof DataRendererList> = {
  title: "Patterns/Data Renderer/List",
  component: DataRendererList,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof DataRendererList>;

const mockItems: DataRendererListItem[] = [
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
  args: { items: mockItems },
};

const InteractiveWrapper = () => {
  const [selected, setSelected] = useState<string | null>(null);
  return <DataRendererList items={mockItems} selectedItemId={selected} onItemClick={(item) => setSelected(item.id)} />;
};

export const Interactive: Story = {
  render: () => <InteractiveWrapper />,
};

export const WithBadges: Story = {
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
  args: { items: [] },
};

export const DeepNesting: Story = {
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
