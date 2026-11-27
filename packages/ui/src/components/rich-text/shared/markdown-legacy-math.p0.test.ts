import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "./markdown-ast";

describe("legacy LaTeX delimiters in Markdown", () => {
  test("keeps unmatched parentheses as text beside existing dollar math", () => {
    const doc = parseMarkdown(String.raw`Use \( to open an equation and $x^2$ to show one.

Use \) to close it.`);
    expect(doc.children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "Use ( to open an equation and " },
          { type: "inlineMath", value: "x^2" },
          { type: "text", value: " to show one." },
        ],
      },
      { type: "paragraph", children: [{ type: "text", value: "Use ) to close it." }] },
    ]);
  });

  test("preserves delimiters inside native code and dollar math", () => {
    const text = [
      "Code: `first line",
      "\\[x\\]`.",
      "",
      "> ```text",
      String.raw`> \(x\)`,
      String.raw`> \[y\]`,
      "> ```",
      "",
      "$$",
      String.raw`\text{\(x\) and \[y\]}`,
      "$$",
    ].join("\n");

    expect(parseMarkdown(text).children).toMatchObject([
      {
        type: "paragraph",
        children: [{ type: "text" }, { type: "inlineCode", value: "first line\n\\[x\\]" }, { type: "text" }],
      },
      { type: "blockquote", children: [{ type: "code", value: "\\(x\\)\n\\[y\\]" }] },
      { type: "math", value: "\\text{\\(x\\) and \\[y\\]}" },
    ]);
  });

  test("keeps bracket delimiters in different list items as text", () => {
    const doc = parseMarkdown(String.raw`- \[
  First item
- Second item
  \]
  Still text`);
    expect(doc.children).toMatchObject([
      {
        type: "list",
        children: [
          { type: "listItem", children: [{ type: "paragraph", children: [{ type: "text", value: "[\nFirst item" }] }] },
          {
            type: "listItem",
            children: [{ type: "paragraph", children: [{ type: "text", value: "Second item\n]\nStill text" }] }],
          },
        ],
      },
    ]);
  });
  test("supports multiline display math with content on each delimiter line", () => {
    const doc = parseMarkdown(String.raw`- \[x + y
  = z\]

## Next section`);
    expect(doc.children).toMatchObject([
      { type: "list", children: [{ type: "listItem", children: [{ type: "math", value: "x + y\n= z" }] }] },
      { type: "heading", children: [{ type: "text", value: "Next section" }] },
    ]);
  });

  test("keeps the next heading when a single-line display formula contains dollars", () => {
    const doc = parseMarkdown(String.raw`\[ $$ \]

## Next`);
    expect(doc.children).toMatchObject([{ type: "math", value: "$$" }, { type: "heading" }]);
  });

  test("rejects an indented display closer even when its line is the end of the file", () => {
    const doc = parseMarkdown(String.raw`\[
x
    \]`);
    expect(doc.children.map((node) => node.type)).toEqual(["paragraph"]);
  });

  test("matches mixed inline delimiters independently and retains escaped dollars", () => {
    const doc = parseMarkdown(String.raw`A leftover \[ before \(\text{\$5}\), then \[y + z\].`);
    expect(doc.children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "A leftover [ before " },
          { type: "inlineMath", value: "\\text{\\$5}" },
          { type: "text", value: ", then " },
          { type: "inlineMath", value: "y + z" },
          { type: "text", value: "." },
        ],
      },
    ]);
  });

  test("matches wrapped inline formulas within a single paragraph", () => {
    const doc = parseMarkdown(String.raw`\(x +
y\) is an equation. So is \[z +
w\].

## Next section`);
    expect(doc.children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "inlineMath", value: "x +\ny" },
          { type: "text", value: " is an equation. So is " },
          { type: "inlineMath", value: "z +\nw" },
          { type: "text", value: "." },
        ],
      },
      { type: "heading" },
    ]);
  });

  test("keeps an escaped placeholder separate from a following inline equation", () => {
    const doc = parseMarkdown(String.raw`\[name]
Independent formula: \[x + y\]

## Next`);
    expect(doc.children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "[name]\nIndependent formula: " },
          { type: "inlineMath", value: "x + y" },
        ],
      },
      { type: "heading" },
    ]);
  });

  test("does not join prose paragraphs with bracket escapes", () => {
    const doc = parseMarkdown(String.raw`\[name]

Use this closing bracket: \]

## Next`);
    expect(doc.children).toMatchObject([
      { type: "paragraph", children: [{ type: "text", value: "[name]" }] },
      { type: "paragraph", children: [{ type: "text", value: "Use this closing bracket: ]" }] },
      { type: "heading" },
    ]);
  });

  test("keeps a URL inside a formula and leaves separate link destinations intact", () => {
    const doc = parseMarkdown(String.raw`Use \(\text{https://example.com}\). [Link](https://example.com/\(path\))`);
    expect(doc.children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "Use " },
          { type: "inlineMath", value: "\\text{https://example.com}" },
          { type: "text", value: ". " },
          { type: "link", url: "https://example.com/(path)" },
        ],
      },
    ]);
  });

  test("renders adjacent legacy formulas as separate equations", () => {
    const doc = parseMarkdown(String.raw`Adjacent: \(x\)\[y\].`);
    expect(doc.children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "Adjacent: " },
          { type: "inlineMath", value: "x" },
          { type: "inlineMath", value: "y" },
          { type: "text", value: "." },
        ],
      },
    ]);
  });

  test("renders a legacy and dollar formula next to each other", () => {
    const doc = parseMarkdown(String.raw`\(x\)$y$\(z\)`);
    expect(doc.children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "inlineMath", value: "x" },
          { type: "inlineMath", value: "y" },
          { type: "inlineMath", value: "z" },
        ],
      },
    ]);
  });
});
