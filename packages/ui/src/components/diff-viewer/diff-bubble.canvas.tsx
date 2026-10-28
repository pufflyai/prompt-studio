import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { DiffBubble } from "./diff-bubble";

const meta: CanvasMeta<typeof DiffBubble> = {
  title: "Patterns/Diff/Diff Bubble",
  component: DiffBubble,
  args: {
    fileName: "src/index.ts",
    additions: 12,
    deletions: 4,
  },
};
export default meta;
type Story = CanvasVariant<typeof DiffBubble>;
export const Default: Story = {
  id: "patterns-diff-diff-bubble--default",
};
export const Ghost: Story = {
  id: "patterns-diff-diff-bubble--ghost",
  args: {
    variant: "ghost",
    label: "Changes",
  },
};
export const NoFileName: Story = {
  id: "patterns-diff-diff-bubble--no-file-name",
  args: {
    fileName: undefined,
    label: "Modified",
  },
};
export const GhostNoFileName: Story = {
  id: "patterns-diff-diff-bubble--ghost-no-file-name",
  args: {
    variant: "ghost",
    fileName: undefined,
    label: "Total diff:",
  },
};
export const Small: Story = {
  id: "patterns-diff-diff-bubble--small",
  args: {
    variant: "ghost",
    size: "small",
    fileName: undefined,
  },
};
export const Clickable: Story = {
  id: "patterns-diff-diff-bubble--clickable",
  args: {
    variant: "ghost",
    size: "small",
    fileName: undefined,
    onClick: () => {},
  },
};
export const LongFileName: Story = {
  id: "patterns-diff-diff-bubble--long-file-name",
  args: {
    fileName: "src/very/long/path/to/a/deeply/nested/file/component-with-a-very-long-name.tsx",
  },
};
export const LargeDiff: Story = {
  id: "patterns-diff-diff-bubble--large-diff",
  args: {
    additions: 1240,
    deletions: 892,
  },
};
