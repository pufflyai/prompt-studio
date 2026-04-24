import { describe, expect, test } from "bun:test";
import { CodeNode } from "@lexical/code";
import { $isAutoLinkNode, AutoLinkNode, LinkNode } from "@lexical/link";
import { $isListItemNode, $isListNode, ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString, CHECK_LIST, TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, $isElementNode, createEditor } from "lexical";
import { ReferenceLinkNode } from "../../markdown-editor/plugins/ReferenceLinkPlugin";
import { REFERENCE_LINK_TRANSFORMER } from "../../markdown-editor/plugins/ReferenceLinkPlugin/ReferenceLinkTransformer";
import { DataTableNode } from "../nodes/DataTableNode";
import { EquationNode } from "../plugins/EquationPlugin/EquationNode";
import { EQUATION_INLINE, EQUATION_MULTILINE } from "../plugins/EquationPlugin/EquationPlugin";
import { HRNode } from "../plugins/HorizontalRulePlugin/HorizontalRuleNode";
import { TRANSFORMERS_EXTENDED } from "./markdown-transformers";

const editorTransformers = [
  CHECK_LIST,
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

  test("round-trips unchecked and checked checklist items", () => {
    const editor = createHeadlessEditor();
    const markdown = "- [ ] todo\n- [x] done";
    let exportedMarkdown = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      const root = $getRoot();
      exportedMarkdown = $convertToMarkdownString(editorTransformers, root);
    });

    expect(exportedMarkdown).toBe(markdown);
  });

  test("imports checklist items as check list nodes", () => {
    const editor = createHeadlessEditor();
    const markdown = "- [ ] unchecked\n- [x] checked";
    let listType = "";
    let firstItemChecked = false;
    let secondItemChecked = false;

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      const root = $getRoot();
      const listNode = root.getFirstChild();
      if ($isListNode(listNode)) {
        listType = listNode.getListType();
        const children = listNode.getChildren();
        if ($isListItemNode(children[0])) firstItemChecked = children[0].getChecked() ?? false;
        if ($isListItemNode(children[1])) secondItemChecked = children[1].getChecked() ?? false;
      }
    });

    expect(listType).toBe("check");
    expect(firstItemChecked).toBe(false);
    expect(secondItemChecked).toBe(true);
  });
});
