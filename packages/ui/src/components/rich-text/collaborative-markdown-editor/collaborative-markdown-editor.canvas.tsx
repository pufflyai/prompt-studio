import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import * as Y from "yjs";
import { MarkdownEditor } from "../markdown-editor/markdown-editor";
import { SharedEditing } from "../markdown-editor/markdown-editor-collaboration.canvas";

const SingleEditorExample = () => {
  const [document] = useState(() => new Y.Doc());
  return <MarkdownEditor defaultState="" collaboration={{ document }} placeholder="Start typing collaboratively…" />;
};
const meta = {
  title: "Patterns/Editors/Collaborative Markdown Editor",
  component: SingleEditorExample,
} satisfies CanvasMeta<typeof SingleEditorExample>;
export default meta;

/** Keep the original design links while exercising the current Markdown source binding. */
export const SplitView: CanvasFrame = {
  id: "patterns-editors-collaborative-markdown-editor--split-view",
  render: SharedEditing.render,
};
export const SingleEditor: CanvasFrame<typeof meta> = {
  id: "patterns-editors-collaborative-markdown-editor--single-editor",
};
