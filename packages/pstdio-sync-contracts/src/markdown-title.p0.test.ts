import { expect, test } from "bun:test";
import { deriveMarkdownTitle } from "./markdown-title";

test.each([
  ["~~~js\nhidden\n~~~\n# Visible", "Visible"],
  ["````markdown\n```js\nhidden\n```\n````\n# Visible", "Visible"],
  ["```js\nhidden\n~~~\nstill hidden\n```\n# Visible", "Visible"],
  ["```js\nhidden\n```extra\nstill hidden\n```  \n# Visible", "Visible"],
  ["![image](url)\n\n> - **[Visible](url)**", "Visible"],
])("derives visible text from Markdown with fenced examples (%s)", (content, expected) => {
  expect(deriveMarkdownTitle(content, "Untitled")).toBe(expected);
});

test("an unfinished fence produces the declared empty title", () => {
  expect(deriveMarkdownTitle("~~~js\nhidden", "Untitled")).toBe("Untitled");
});
