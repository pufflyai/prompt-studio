import { CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { createEditor } from "lexical";
import { ReferenceLinkNode } from "../../markdown-editor/plugins/ReferenceLinkPlugin";
import { editorTransformers } from "../editor-config";
import { DataTableNode } from "../nodes/DataTableNode";
import { EquationNode } from "../plugins/EquationPlugin/EquationNode";
import { HRNode } from "../plugins/HorizontalRulePlugin/HorizontalRuleNode";

export { editorTransformers };

export function createHeadlessEditor() {
  return createEditor({
    nodes: [
      QuoteNode,
      LinkNode,
      AutoLinkNode,
      DataTableNode,
      HeadingNode,
      ListNode,
      ListItemNode,
      CodeNode,
      EquationNode,
      HRNode,
      ReferenceLinkNode,
    ],
  });
}
