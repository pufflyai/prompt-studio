import { describe, expect, test } from "bun:test";
import { $getRoot } from "lexical";
import { exportLexicalToMarkdown, importMarkdownToLexical, parseMarkdown } from "./markdown-codec";
import { $isRawHtmlNode } from "./nodes/RawHtmlNode";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

const withoutPositions = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutPositions);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "position")
      .map(([key, entry]) => [key, withoutPositions(entry)]),
  );
};

const roundTrip = (markdown: string) => {
  const editor = createHeadlessEditor();
  let result = "";

  editor.update(
    () => {
      importMarkdownToLexical(markdown);
    },
    { discrete: true },
  );

  editor.read(() => {
    result = exportLexicalToMarkdown($getRoot());
  });

  return result;
};

describe("Markdown codec", () => {
  test("semantically round-trips CommonMark and GFM blocks and inline content", () => {
    const markdown = `# Heading

> A **bold** quote with [a link](https://example.com "Title").

- [x] checked
- [ ] item with ~~deleted~~ text and${"  "}
  a hard break

1. first
2. second

![Alt text](https://example.com/image.png "Image")

<mark data-safe="yes">HTML</mark>

---

\`\`\`ts
const value = 1;
\`\`\``;
    const exported = roundTrip(markdown);

    expect(withoutPositions(parseMarkdown(exported))).toEqual(withoutPositions(parseMarkdown(markdown)));
  });

  test("preserves difficult GFM table cells and alignment", () => {
    const markdown = `| Name | Name |  | Code |
| :--- | ---: | :---: | --- |
| Alice | Admin | a\\|b | \`left\\|right\` |
| **Bob** |  | ~~old~~ | 0 |`;
    const exported = roundTrip(markdown);
    const tree = parseMarkdown(exported);

    expect(withoutPositions(tree)).toEqual(withoutPositions(parseMarkdown(markdown)));
    expect(exported).toContain("a\\|b");
    expect(exported).toContain("`left\\|right`");
  });

  test("resolves reference links without losing their meaning", () => {
    const markdown = `[Prompt Studio][project] and ![Logo][logo].

[project]: https://example.com "Project"
[logo]: https://example.com/logo.png "Logo"`;
    const exported = roundTrip(markdown);
    const tree = withoutPositions(parseMarkdown(exported));

    expect(tree).toEqual(
      withoutPositions(
        parseMarkdown(
          '[Prompt Studio](https://example.com "Project") and ![Logo](https://example.com/logo.png "Logo").',
        ),
      ),
    );
  });

  test("keeps the existing inline and block equation delimiters", () => {
    const markdown = `Inline \\(x + y\\) equation.

\\[
a + b = c
\\]`;
    const exported = roundTrip(markdown);

    expect(exported).toContain("$x + y$");
    expect(exported).toContain("$$\na + b = c\n$$");
    expect(roundTrip(exported)).toBe(exported);
  });

  test("hides HTML comments while preserving their source markers", () => {
    const markdown = `Visible before.

<!-- fds:source-only:start -->

<!-- keep this metadata -->

<!-- fds:source-only:end -->

Visible after.`;
    const editor = createHeadlessEditor();

    editor.update(
      () => {
        importMarkdownToLexical(markdown);
      },
      { discrete: true },
    );

    editor.read(() => {
      const comments = $getRoot().getChildren().filter($isRawHtmlNode);
      expect(comments.map((comment) => comment.getSource())).toEqual([
        "<!-- fds:source-only:start -->",
        "<!-- keep this metadata -->",
        "<!-- fds:source-only:end -->",
      ]);
      expect(comments.map((comment) => comment.getTextContent())).toEqual(["", "", ""]);
      expect(exportLexicalToMarkdown($getRoot())).toContain("<!-- fds:source-only:start -->");
      expect(exportLexicalToMarkdown($getRoot())).toContain("<!-- fds:source-only:end -->");
    });
  });
});
