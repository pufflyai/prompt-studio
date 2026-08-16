import { createEditor } from "lexical";
import { editorNodes, editorTransformers } from "../editor-config";

export { editorTransformers };

export function createHeadlessEditor() {
  return createEditor({
    nodes: editorNodes,
  });
}
