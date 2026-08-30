import { describe, expect, test } from "bun:test";
import { $createParagraphNode, $createTextNode, $getRoot, $isElementNode } from "lexical";
import { createMarkdownSourceDocument } from "./markdown-source-document";
import { updateMarkdownTableCell } from "./markdown-table";
import { $isDataTableNode } from "./nodes/DataTableNode";
import { $isEquationNode } from "./plugins/EquationPlugin/EquationNode";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

const sourceRoundTrip = (markdown: string, edit?: (editor: ReturnType<typeof createHeadlessEditor>) => void) => {
  const editor = createHeadlessEditor();
  const sourceDocument = createMarkdownSourceDocument(markdown);
  let result = "";

  editor.update(() => sourceDocument.importToLexical(), { discrete: true });
  edit?.(editor);
  editor.read(() => {
    result = sourceDocument.exportFromLexical($getRoot());
  });

  return result;
};

describe("Markdown source document", () => {
  test("preserves the exact source when nothing changed", () => {
    const markdown = [
      "# Heading ###\r",
      "\r",
      "* item\r",
      "\r",
      "[Prompt Studio][project] and {{fds:text:EXAMPLE.REGULAR_INSEAM_SENTENCE}}.\r",
      "\r",
      "[project]: https://example.com  'Project'\r",
      "\r",
      "| Name |Value|\r",
      "|:---|---:|\r",
      "| Alice | 1 |\r",
      "\r",
      "~~~json\r",
      '{"value": true}\r',
      "~~~",
    ].join("\n");

    expect(sourceRoundTrip(markdown)).toBe(markdown);
  });

  test("changes one word without rewriting adjacent Markdown", () => {
    const markdown = `Before {{fds:text:EXAMPLE.REGULAR_INSEAM_SENTENCE}} after.

| Name |Value|
|:---|---:|
| Alice | 1 |

[Prompt Studio][project]

[project]: https://example.com  'Project'`;

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          const firstText = $getRoot().getAllTextNodes()[0];
          firstText?.setTextContent(firstText.getTextContent().replace("Before", "After"));
        },
        { discrete: true },
      );
    });

    expect(result).toBe(markdown.replace("Before", "After"));
  });

  test("changes one token character without escaping its underscores", () => {
    const markdown = "{{fds:text:EXAMPLE.REGULAR_INSEAM_SENTENCE}}";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          const firstText = $getRoot().getAllTextNodes()[0];
          firstText?.setTextContent(firstText.getTextContent().replace("SENTENCE", "PHRASE"));
        },
        { discrete: true },
      );
    });

    expect(result).toBe("{{fds:text:EXAMPLE.REGULAR_INSEAM_PHRASE}}");
  });

  test("preserves escapes and character references beside an edit", () => {
    const markdown = "Edit beside a\\*b &amp; {{token_with_underscores}}.";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => $getRoot().getAllTextNodes()[0]?.setTextContent("Change beside a*b & {{token_with_underscores}}."),
        {
          discrete: true,
        },
      );
    });

    expect(result).toBe("Change beside a\\*b &amp; {{token_with_underscores}}.");
  });

  test("changes formatting without rewriting adjacent source", () => {
    const markdown = "Format this next to {{fds:text:EXAMPLE.REGULAR_INSEAM_SENTENCE}}.";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          const firstText = $getRoot().getAllTextNodes()[0];
          const [format] = firstText?.splitText("Format".length) ?? [];
          format?.toggleFormat("bold");
        },
        { discrete: true },
      );
    });

    expect(result).toBe("**Format** this next to {{fds:text:EXAMPLE.REGULAR_INSEAM_SENTENCE}}.");
  });

  test("removes alternate emphasis markers without touching the next block", () => {
    const markdown = "__Format__ this.\n\n*Keep this marker*.";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(() => $getRoot().getAllTextNodes()[0]?.toggleFormat("bold"), { discrete: true });
    });

    expect(result).toBe("Format this.\n\n*Keep this marker*.");
  });

  test("edits legacy math without replacing its delimiters", () => {
    const markdown = "Inline \\(x + y\\) equation.";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          const paragraph = $getRoot().getFirstChild();
          const equation = $isElementNode(paragraph) ? paragraph.getChildren()[1] : null;
          if ($isEquationNode(equation)) equation.setEquation("x + z");
        },
        { discrete: true },
      );
    });

    expect(result).toBe("Inline \\(x + z\\) equation.");
  });

  test("edits one table cell without realigning the table", () => {
    const markdown = "| Name |Value|\n|:---|---:|\n| Alice | 1 |";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          const table = $getRoot().getFirstChild();
          if (!$isDataTableNode(table)) return;
          const value = table.getTable();
          table.setTable(updateMarkdownTableCell(value, value.rows[0]!.id, value.columns[1]!.id, "2"));
        },
        { discrete: true },
      );
    });

    expect(result).toBe("| Name |Value|\n|:---|---:|\n| Alice | 2 |");
  });

  test("uses original table offsets after legacy math", () => {
    const markdown = "Inline \\(x + y\\).\n\n| Name |Value|\n|:---|---:|\n| Alice | 1 |";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          const table = $getRoot().getLastChild();
          if (!$isDataTableNode(table)) return;
          const value = table.getTable();
          table.setTable(updateMarkdownTableCell(value, value.rows[0]!.id, value.columns[1]!.id, "2"));
        },
        { discrete: true },
      );
    });

    expect(result).toBe("Inline \\(x + y\\).\n\n| Name |Value|\n|:---|---:|\n| Alice | 2 |");
  });

  test("escapes a pipe inserted into one table cell", () => {
    const markdown = "| Name | Role |\n| --- | --- |\n| Alice | Admin |";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          const table = $getRoot().getFirstChild();
          if (!$isDataTableNode(table)) return;
          const value = table.getTable();
          table.setTable(updateMarkdownTableCell(value, value.rows[0]!.id, value.columns[0]!.id, "Alice | Owner"));
        },
        { discrete: true },
      );
    });

    expect(result).toBe("| Name | Role |\n| --- | --- |\n| Alice \\| Owner | Admin |");
  });

  test("uses the loaded line ending when inserting a block", () => {
    const markdown = "First block.\r\n";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          $getRoot().append($createParagraphNode().append($createTextNode("Second block.")));
        },
        { discrete: true },
      );
    });

    expect(result).toBe("First block.\r\n\r\nSecond block.\r\n");
  });

  test("keeps the CRLF after an edited line", () => {
    const markdown = "Before.\r\n\r\nEdit target: ORIGINAL\r\n\r\nAfter.\r\n";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          const target = $getRoot()
            .getAllTextNodes()
            .find((node) => node.getTextContent().includes("ORIGINAL"));
          target?.setTextContent(target.getTextContent().replace("ORIGINAL", "REVISED"));
        },
        { discrete: true },
      );
    });

    expect(result).toBe(markdown.replace("ORIGINAL", "REVISED"));
  });

  test("keeps moved blocks in their original spelling", () => {
    const markdown = "First *italic*.\n\nSecond with __bold__.";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          const [first, second] = $getRoot().getChildren();
          if (first && second) second.insertAfter(first);
        },
        { discrete: true },
      );
    });

    expect(result).toBe("Second with __bold__.\n\nFirst *italic*.");
  });

  test("deletes one block without rewriting its neighbors", () => {
    const markdown = "Keep __one__.\n\nDelete me.\n\nKeep *two*.";

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(() => $getRoot().getChildren()[1]?.remove(), { discrete: true });
    });

    expect(result).toBe("Keep __one__.\n\nKeep *two*.");
  });

  test("restores the exact source after returning to the loaded editor state", () => {
    const markdown = "Original __source__ with {{token_with_underscores}}.";
    const editor = createHeadlessEditor();
    const sourceDocument = createMarkdownSourceDocument(markdown);

    editor.update(() => sourceDocument.importToLexical(), { discrete: true });
    const loadedState = editor.getEditorState();
    editor.update(() => $getRoot().getAllTextNodes()[0]?.setTextContent("Edited source with "), { discrete: true });
    editor.setEditorState(loadedState);

    editor.read(() => expect(sourceDocument.exportFromLexical($getRoot())).toBe(markdown));
  });

  test("preserves a large token-heavy document after one edit", () => {
    const line = "Before {{fds:text:EXAMPLE.REGULAR_INSEAM_SENTENCE}} after.";
    const markdown = Array.from({ length: 1_100 }, () => line).join("\n\n");

    const result = sourceRoundTrip(markdown, (editor) => {
      editor.update(
        () => {
          const firstText = $getRoot().getAllTextNodes()[0];
          firstText?.setTextContent(firstText.getTextContent().replace("Before", "After"));
        },
        { discrete: true },
      );
    });

    expect(result).toBe(markdown.replace("Before", "After"));
  });
});
