import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { LazyMarkdownEditor } from "./lazy-markdown-editor";

const meta: CanvasMeta<typeof LazyMarkdownEditor> = {
  title: "Patterns/Editors/Lazy Markdown Editor",
  component: LazyMarkdownEditor,
  args: { defaultState: "# Ticket description\n\nThe editor loads when this view opens.", isEditable: true },
};
export default meta;
type Story = CanvasVariant<typeof LazyMarkdownEditor>;
export const Default: Story = {
  id: "patterns-editors-lazy-markdown-editor--default",
};
