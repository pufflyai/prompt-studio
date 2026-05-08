import { describe, expect, test } from "bun:test";
import { $isAutoLinkNode } from "@lexical/link";
import { $isListItemNode, $isListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { $getRoot, $isElementNode } from "lexical";
import { createHeadlessEditor, editorTransformers } from "./markdown-transformers-test-utils";

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

  test("round-trips escaped plain text underscores without converting them to emphasis", () => {
    const editor = createHeadlessEditor();
    const markdown = "\\_hello\\_ world";
    let firstExport = "";
    let secondExport = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      firstExport = $convertToMarkdownString(editorTransformers, $getRoot());
    });

    editor.update(
      () => {
        $convertFromMarkdownString(firstExport, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      secondExport = $convertToMarkdownString(editorTransformers, $getRoot());
    });

    expect(firstExport).toBe(markdown);
    expect(secondExport).toBe(markdown);
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
