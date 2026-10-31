import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { TreeResourceActionsStory } from "./tree-resource-actions-story";

const meta = {
  title: "pstdio-workbench/Guides/Tree resource actions",
  component: TreeResourceActionsStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof TreeResourceActionsStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Sidenav: Story = {
  id: "pstdio-workbench-guides-tree-resource-actions--sidenav",
  args: { region: "sidenav" },
};
export const Standalone: Story = {
  id: "pstdio-workbench-guides-tree-resource-actions--standalone",
  args: { region: "main" },
};
