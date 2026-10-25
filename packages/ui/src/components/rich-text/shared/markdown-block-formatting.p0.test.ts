import { expect, test } from "bun:test";
import { $createHeadingNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $getRoot, $getSelection } from "lexical";
import { createMarkdownSourceDocument } from "./markdown-source-document";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

test.each([
  "\n\n\n\n",
  "\r\n\r\n\r\n",
])("formats every selected paragraph after preserved separators %j as a heading", (separator) => {
  const source = ["First paragraph.", "Second paragraph.", "Third paragraph."].join(separator);
  const document = createMarkdownSourceDocument(source);
  const editor = createHeadlessEditor();
  editor.update(() => document.importToLexical(), { discrete: true });
  editor.update(
    () => {
      $getRoot().select(0, $getRoot().getChildrenSize());
      $setBlocksType($getSelection(), () => $createHeadingNode("h2"));
    },
    { discrete: true },
  );

  editor.read(() => {
    expect(document.exportFromLexical($getRoot())).toBe(
      ["## First paragraph.", "## Second paragraph.", "## Third paragraph."].join(separator),
    );
  });
});

test("formats paragraphs without moving a retained reference definition into a heading", () => {
  const source = 'First paragraph.\n\n\n\n[Second paragraph][link].\n\n[link]: https://example.com "Keep"';
  const document = createMarkdownSourceDocument(source);
  const editor = createHeadlessEditor();
  editor.update(() => document.importToLexical(), { discrete: true });
  editor.update(
    () => {
      $getRoot().select(0, $getRoot().getChildrenSize());
      $setBlocksType($getSelection(), () => $createHeadingNode("h2"));
    },
    { discrete: true },
  );

  editor.read(() => {
    expect(document.exportFromLexical($getRoot())).toBe(
      '## First paragraph.\n\n\n\n## [Second paragraph][link].\n\n[link]: https://example.com "Keep"',
    );
  });
});
