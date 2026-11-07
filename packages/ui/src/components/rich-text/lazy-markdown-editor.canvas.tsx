import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { LazyMarkdownEditor } from "./lazy-markdown-editor";
import { MarkdownEditorSkeleton } from "./markdown-editor-skeleton";

const meta: CanvasMeta<typeof LazyMarkdownEditor> = {
  title: "Design system/Patterns/Editors/Lazy Markdown editor",
  component: LazyMarkdownEditor,
  args: { defaultState: "# Ticket description\n\nThe editor loads when this view opens.", isEditable: true },
};
export default meta;
type Story = CanvasFrame<typeof LazyMarkdownEditor>;
export const Default: Story = {
  id: "patterns-editors-lazy-markdown-editor--default",
};
export const Loading: Story = {
  id: "patterns-editors-lazy-markdown-editor--loading",
  render: () => <MarkdownEditorSkeleton />,
};
