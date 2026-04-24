import { describe, expect, test } from "bun:test";
import { CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { $isListNode, ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, CHECK_LIST, TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot, createEditor } from "lexical";
import { normalizeMarkdownListIndentation, splitFrontmatter } from "./markdown";

const transformers = [CHECK_LIST, ...TRANSFORMERS];

function createHeadlessEditor() {
  return createEditor({
    nodes: [QuoteNode, LinkNode, AutoLinkNode, HeadingNode, ListNode, ListItemNode, CodeNode],
  });
}

describe("splitFrontmatter", () => {
  test("returns frontmatter and body", () => {
    const content = "---\ntitle: Test\n---\nBody";
    const result = splitFrontmatter(content);

    expect(result).toEqual({
      frontmatter: "---\ntitle: Test\n---\n",
      body: "Body",
    });
  });
});

describe("normalizeMarkdownListIndentation", () => {
  test("normalizes two-space nested list indentation so Lexical imports nested lists", () => {
    const editor = createHeadlessEditor();
    const markdown = "- parent\n  - child";

    editor.update(
      () => {
        $convertFromMarkdownString(normalizeMarkdownListIndentation(markdown), transformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      const root = $getRoot();
      const listNode = root.getFirstChild();

      expect($isListNode(listNode)).toBe(true);
      if (!$isListNode(listNode)) return;

      const hasNestedListItem = listNode
        .getChildren()
        .some((listItem) => listItem.getChildren().some((child) => child.getType() === "list"));

      expect(hasNestedListItem).toBe(true);
    });
  });

  test("normalizes multi-level two-space nested list indentation", () => {
    const normalized = normalizeMarkdownListIndentation("- parent\n  - child\n    - grandchild");

    expect(normalized).toBe("- parent\n    - child\n        - grandchild");
  });

  test("keeps nested list continuation lines aligned with the normalized list depth", () => {
    const normalized = normalizeMarkdownListIndentation("- parent\n  - child\n    continuation");

    expect(normalized).toBe("- parent\n    - child\n      continuation");
  });

  test("resets list indentation context after an unindented paragraph", () => {
    const normalized = normalizeMarkdownListIndentation("- parent\nparagraph\n  - child");

    expect(normalized).toBe("- parent\nparagraph\n  - child");
  });

  test("normalizes tab-indented nested list items", () => {
    const normalized = normalizeMarkdownListIndentation("- parent\n\t- child");

    expect(normalized).toBe("- parent\n    - child");
  });
});
