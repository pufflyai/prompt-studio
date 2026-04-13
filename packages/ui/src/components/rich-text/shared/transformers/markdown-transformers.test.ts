import { describe, expect, test } from "bun:test";
import { CodeNode } from "@lexical/code";
import { $isAutoLinkNode, AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, $isElementNode, createEditor } from "lexical";
import { ReferenceLinkNode } from "../../markdown-editor/plugins/ReferenceLinkPlugin";
import { REFERENCE_LINK_TRANSFORMER } from "../../markdown-editor/plugins/ReferenceLinkPlugin/ReferenceLinkTransformer";
import { DataTableNode } from "../nodes/DataTableNode";
import { CodeBlockNode } from "../plugins/CodePlugin/CodeNode";
import { EquationNode } from "../plugins/EquationPlugin/EquationNode";
import { EQUATION_INLINE, EQUATION_MULTILINE } from "../plugins/EquationPlugin/EquationPlugin";
import { HRNode } from "../plugins/HorizontalRulePlugin/HorizontalRuleNode";
import { TRANSFORMERS_EXTENDED } from "./markdown-transformers";

const editorTransformers = [
  ...TRANSFORMERS,
  ...TRANSFORMERS_EXTENDED,
  EQUATION_INLINE,
  EQUATION_MULTILINE,
  REFERENCE_LINK_TRANSFORMER,
];

function createHeadlessEditor() {
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
      CodeBlockNode,
      EquationNode,
      HRNode,
      ReferenceLinkNode,
    ],
  });
}

describe("markdown transformers", () => {
  test("imports bare https links in list items as autolinks", () => {
    const editor = createHeadlessEditor();
    const markdown = "- https://github.com/OneFinSE/enfidem2-project/pull/1463";
    let importedLinkType = "";
    let importedLinkUrl = "";
    let exportedMarkdown = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      const root = $getRoot();
      const listNode = root.getFirstChild();
      const listItemNode = $isElementNode(listNode) ? listNode.getFirstChild() : null;
      const linkNode = $isElementNode(listItemNode) ? listItemNode.getFirstChild() : null;

      importedLinkType = linkNode?.getType() ?? "";
      importedLinkUrl = $isAutoLinkNode(linkNode) ? linkNode.getURL() : "";
      exportedMarkdown = $convertToMarkdownString(editorTransformers, root);
    });

    expect(importedLinkType).toBe("autolink");
    expect(importedLinkUrl).toBe("https://github.com/OneFinSE/enfidem2-project/pull/1463");
    expect(exportedMarkdown).toBe(markdown);
  });
});
