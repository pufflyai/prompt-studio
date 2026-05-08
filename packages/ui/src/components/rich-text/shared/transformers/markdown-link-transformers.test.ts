import { describe, expect, test } from "bun:test";
import { $createAutoLinkNode, $isAutoLinkNode, $isLinkNode } from "@lexical/link";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { $createParagraphNode, $createTextNode, $getRoot, $isElementNode } from "lexical";
import { createHeadlessEditor, editorTransformers } from "./markdown-transformers-test-utils";

describe("markdown link transformers", () => {
  test("round-trips bare https URLs containing underscores without adding escape characters", () => {
    const editor = createHeadlessEditor();
    const markdown = "https://example.com/foo_bar";
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

  test("recovers bare URLs that already contain markdown-escape backslashes", () => {
    const editor = createHeadlessEditor();
    const corrupted = "https://example.com/foo\\_bar";
    let exported = "";

    editor.update(
      () => {
        $convertFromMarkdownString(corrupted, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      exported = $convertToMarkdownString(editorTransformers, $getRoot());
    });

    expect(exported).toBe("https://example.com/foo_bar");
  });

  test("round-trips markdown links whose URL contains underscores without adding escape characters", () => {
    const editor = createHeadlessEditor();
    const markdown = "[example](https://example.com/foo_bar)";
    let importedLinkType = "";
    let importedLinkUrl = "";
    let firstExport = "";
    let secondExport = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      const paragraphNode = $getRoot().getFirstChild();
      const linkNode = $isElementNode(paragraphNode) ? paragraphNode.getFirstChild() : null;

      importedLinkType = linkNode?.getType() ?? "";
      importedLinkUrl = $isLinkNode(linkNode) && !$isAutoLinkNode(linkNode) ? linkNode.getURL() : "";
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

    expect(importedLinkType).toBe("link");
    expect(importedLinkUrl).toBe("https://example.com/foo_bar");
    expect(firstExport).toBe(markdown);
    expect(secondExport).toBe(markdown);
  });

  test("round-trips markdown links whose text contains underscores without adding escape characters", () => {
    const editor = createHeadlessEditor();
    const markdown = "[https://example.com/foo_bar](https://example.com/foo_bar)";
    let exportedMarkdown = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      exportedMarkdown = $convertToMarkdownString(editorTransformers, $getRoot());
    });

    expect(exportedMarkdown).toBe(markdown);
  });

  test.each([
    "[**https://example.com/foo_bar**](https://example.com/foo_bar)",
    "[*https://example.com/foo_bar*](https://example.com/foo_bar)",
    "[`https://example.com/foo_bar`](https://example.com/foo_bar)",
  ])("preserves formatting for markdown links whose text matches the URL", (markdown) => {
    const editor = createHeadlessEditor();
    let exportedMarkdown = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      exportedMarkdown = $convertToMarkdownString(editorTransformers, $getRoot());
    });

    expect(exportedMarkdown).toBe(markdown);
  });
});

describe("markdown link title and edge-case transformers", () => {
  test("round-trips markdown links with escaped quote titles", () => {
    const editor = createHeadlessEditor();
    const markdown = '[example](https://example.com/foo_bar "title \\"quoted\\"")';
    let importedLinkTitle = "";
    let exportedMarkdown = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      const paragraphNode = $getRoot().getFirstChild();
      const linkNode = $isElementNode(paragraphNode) ? paragraphNode.getFirstChild() : null;

      importedLinkTitle = $isLinkNode(linkNode) && !$isAutoLinkNode(linkNode) ? linkNode.getTitle() : "";
      exportedMarkdown = $convertToMarkdownString(editorTransformers, $getRoot());
    });

    expect(importedLinkTitle).toBe('title "quoted"');
    expect(exportedMarkdown).toBe(markdown);
  });

  test("round-trips markdown links with empty titles", () => {
    const editor = createHeadlessEditor();
    const markdown = '[example](https://example.com/foo_bar "")';
    let importedLinkTitle = "missing";
    let exportedMarkdown = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      const paragraphNode = $getRoot().getFirstChild();
      const linkNode = $isElementNode(paragraphNode) ? paragraphNode.getFirstChild() : null;

      importedLinkTitle = $isLinkNode(linkNode) && !$isAutoLinkNode(linkNode) ? linkNode.getTitle() : "missing";
      exportedMarkdown = $convertToMarkdownString(editorTransformers, $getRoot());
    });

    expect(importedLinkTitle).toBe("");
    expect(exportedMarkdown).toBe(markdown);
  });

  test("round-trips markdown links with escaped backslash titles", () => {
    const editor = createHeadlessEditor();
    const markdown = '[example](https://example.com/foo_bar "path \\\\ share")';
    let importedLinkTitle = "";
    let exportedMarkdown = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      const paragraphNode = $getRoot().getFirstChild();
      const linkNode = $isElementNode(paragraphNode) ? paragraphNode.getFirstChild() : null;

      importedLinkTitle = $isLinkNode(linkNode) && !$isAutoLinkNode(linkNode) ? linkNode.getTitle() : "";
      exportedMarkdown = $convertToMarkdownString(editorTransformers, $getRoot());
    });

    expect(importedLinkTitle).toBe("path \\ share");
    expect(exportedMarkdown).toBe(markdown);
  });

  test("round-trips markdown links with unmatched opening brackets", () => {
    const editor = createHeadlessEditor();
    const markdown = "[prefix[example](https://example.com/foo_bar)";
    let exportedMarkdown = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      exportedMarkdown = $convertToMarkdownString(editorTransformers, $getRoot());
    });

    expect(exportedMarkdown).toBe(markdown);
  });

  test("does not import markdown links with unmatched closing brackets", () => {
    const editor = createHeadlessEditor();
    const markdown = "[example]](https://example.com/foo_bar)";
    let importedLinkType = "";

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, editorTransformers, undefined, false);
      },
      { discrete: true },
    );

    editor.read(() => {
      const paragraphNode = $getRoot().getFirstChild();
      const firstChild = $isElementNode(paragraphNode) ? paragraphNode.getFirstChild() : null;

      importedLinkType = firstChild?.getType() ?? "";
    });

    expect(importedLinkType).toBe("text");
  });

  test("preserves edited autolink text when it no longer matches the URL", () => {
    const editor = createHeadlessEditor();
    let exportedMarkdown = "";

    editor.update(
      () => {
        const paragraphNode = $createParagraphNode();
        const autoLinkNode = $createAutoLinkNode("https://example.com/foo_bar");

        autoLinkNode.append($createTextNode("edited_text"));
        paragraphNode.append(autoLinkNode);
        $getRoot().append(paragraphNode);
      },
      { discrete: true },
    );

    editor.read(() => {
      exportedMarkdown = $convertToMarkdownString(editorTransformers, $getRoot());
    });

    expect(exportedMarkdown).toBe("edited\\_text");
  });

  test("round-trips escaped underscores in markdown link text without accumulating escapes", () => {
    const editor = createHeadlessEditor();
    const markdown = "[foo\\_bar](https://example.com)";
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
});
