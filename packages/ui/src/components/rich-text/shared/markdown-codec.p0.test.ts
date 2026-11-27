import { describe, expect, test } from "bun:test";
import { $getRoot } from "lexical";
import {
  exportLexicalToMarkdown,
  importMarkdownToLexical,
  parseMarkdown,
  serializeMarkdownAst,
} from "./markdown-codec";
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
  test("preserves paragraphs, nested blocks, and inline content inside quotes", () => {
    const markdown = `> First **bold** paragraph with [a link](https://example.com).\\
> Continued line.
>
> Second *paragraph*.
>
> - First item
> - Second item
>
> After the list.
>
> > Nested quote`;
    expect(withoutPositions(parseMarkdown(roundTrip(markdown)))).toEqual(withoutPositions(parseMarkdown(markdown)));
  });

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
    const markdown = `Inline \\(x + y\\) equation and square brackets \\[y + z\\].

\\[
a + b = c
\\]

\\[d + e = f\\]`;
    const exported = roundTrip(markdown);

    expect(exported).toContain("$x + y$");
    expect(exported).toContain("$y + z$");
    expect(exported).toContain("$$\na + b = c\n$$");
    expect(exported).toContain("$$\nd + e = f\n$$");
    expect(roundTrip(exported)).toBe(exported);
  });

  test("round-trips adjoining equations through the rich-text editor", () => {
    const markdown = String.raw`\(x\)\[y\]`;
    const expected = [
      {
        type: "paragraph",
        children: [
          { type: "inlineMath", value: "x" },
          { type: "inlineMath", value: "y" },
        ],
      },
    ];
    expect(parseMarkdown(roundTrip(markdown)).children).toMatchObject(expected);
  });

  test("round-trips adjoining equations containing escaped dollar signs without adding a space", () => {
    const markdown = String.raw`\(\$5\)\(\$6\)`;
    expect(roundTrip(markdown)).toBe(markdown);
    expect(parseMarkdown(markdown).children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "inlineMath", value: String.raw`\$5` },
          { type: "inlineMath", value: String.raw`\$6` },
        ],
      },
    ]);
  });

  test("keeps prices in prose and still matches numeric and symbolic formulas", () => {
    const markdown = "Prices are $5 and $10. A range is $1,250.50–$1,500.75. The value is $5$ or $x + 1$.";
    expect(parseMarkdown(markdown).children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "Prices are $5 and $10. A range is $1,250.50–$1,500.75. The value is " },
          { type: "inlineMath", value: "5" },
          { type: "text", value: " or " },
          { type: "inlineMath", value: "x + 1" },
          { type: "text", value: "." },
        ],
      },
    ]);
  });

  test.each(["-x", "α", "[x]", "|x|"])("keeps a price separate from a formula beginning with %s", (formula) => {
    const markdown = `It costs $5 and $${formula}$ is a term.`;
    expect(parseMarkdown(markdown).children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "It costs $5 and " },
          { type: "inlineMath", value: formula },
          { type: "text", value: " is a term." },
        ],
      },
    ]);
  });

  test("keeps a numeric coefficient formula followed immediately by a digit", () => {
    const source = "Use $2x$2 times.";
    expect(parseMarkdown(roundTrip(source)).children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "Use " },
          { type: "inlineMath", value: "2x" },
          { type: "text", value: "2 times." },
        ],
      },
    ]);
  });

  test("serializes adjacent equations containing backticks as distinct math", () => {
    const serialized = serializeMarkdownAst({
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "inlineMath", value: "`a" },
            { type: "inlineMath", value: "b`" },
          ],
        },
      ],
    });
    const paragraph = parseMarkdown(serialized).children[0];
    expect(
      paragraph?.type === "paragraph" && paragraph.children.filter((child) => child.type === "inlineMath"),
    ).toMatchObject([{ value: "`a" }, { value: "b`" }]);
  });

  test("keeps unmatched square bracket escapes as text around valid equations", () => {
    const markdown = `\\]

\\[name] and \\[x + y\\]

\\[

## Protocol`;

    const tree = parseMarkdown(markdown);
    expect(tree.children).toMatchObject([
      { type: "paragraph", children: [{ type: "text", value: "]" }] },
      {
        type: "paragraph",
        children: [
          { type: "text", value: "[name] and " },
          { type: "inlineMath", value: "x + y" },
        ],
      },
      { type: "paragraph", children: [{ type: "text", value: "[" }] },
      { type: "heading", children: [{ type: "text", value: "Protocol" }] },
    ]);
  });

  test("preserves legacy multiline equations inside Markdown containers", () => {
    const markdown = String.raw`> \[
> x + y
> \]

- With an equation:

    \[
    y + z
    \]`;
    const tree = parseMarkdown(markdown);
    expect(tree.children).toMatchObject([
      { type: "blockquote", children: [{ type: "math", value: "x + y" }] },
      {
        type: "list",
        children: [{ type: "listItem", children: [{ type: "paragraph" }, { type: "math", value: "y + z" }] }],
      },
    ]);
  });

  test("keeps an escaped backslash before a closing bracket as text", () => {
    const tree = parseMarkdown(String.raw`\[name\\]

## Protocol`);
    expect(tree.children).toMatchObject([
      { type: "paragraph", children: [{ type: "text", value: "[name\\]" }] },
      { type: "heading" },
    ]);
  });

  test("keeps square bracket escapes in separate blockquotes as text", () => {
    const tree = parseMarkdown(String.raw`> \[

## Heading

> \]
>
> Quoted text.`);
    expect(tree.children).toMatchObject([
      { type: "blockquote", children: [{ type: "paragraph", children: [{ type: "text", value: "[" }] }] },
      { type: "heading" },
      {
        type: "blockquote",
        children: [
          { type: "paragraph", children: [{ type: "text", value: "]" }] },
          { type: "paragraph", children: [{ type: "text", value: "Quoted text." }] },
        ],
      },
    ]);
  });

  test("keeps a standalone equation with a literal backtick", () => {
    const tree = parseMarkdown("\\[ \\text{sample `quote} \\]");
    expect(tree.children).toMatchObject([{ type: "math", value: "\\text{sample `quote}" }]);
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
