import type { Meta, StoryObj } from "@storybook/react";
import { DiffBubble } from "./diff-bubble";

const meta: Meta<typeof DiffBubble> = {
  title: "Patterns/Diff/Diff Bubble",
  component: DiffBubble,
  args: {
    fileName: "src/index.ts",
    additions: 12,
    deletions: 4,
  },
};

export default meta;

type Story = StoryObj<typeof DiffBubble>;

export const Default: Story = {};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    label: "Changes",
  },
};

export const NoFileName: Story = {
  args: {
    fileName: undefined,
    label: "Modified",
  },
};

export const GhostNoFileName: Story = {
  args: {
    variant: "ghost",
    fileName: undefined,
    label: "Total diff:",
  },
};

export const Small: Story = {
  args: {
    variant: "ghost",
    size: "small",
    fileName: undefined,
  },
};

export const Clickable: Story = {
  args: {
    variant: "ghost",
    size: "small",
    fileName: undefined,
    onClick: () => {},
  },
};

export const LongFileName: Story = {
  args: {
    fileName: "src/very/long/path/to/a/deeply/nested/file/component-with-a-very-long-name.tsx",
  },
};

export const LargeDiff: Story = {
  args: {
    additions: 1240,
    deletions: 892,
  },
};
