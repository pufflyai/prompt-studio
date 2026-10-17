import { expect, test } from "bun:test";
import { $getRoot, $isElementNode } from "lexical";
import { ReferenceLinkNode } from "../markdown-editor/plugins/ReferenceLinkPlugin/ReferenceLinkNode";
import { importMarkdownToLexical } from "./markdown-import";
import { createMarkdownSourceDocument } from "./markdown-source-document";
import { MarkdownLinkNode } from "./nodes/MarkdownLinkNode";
import { importStreamingMarkdownToLexical } from "./streaming-markdown";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

test.each([
  "https://example.com",
  "https://example.com/docs?a=1&b=2",
  "http://example.com/path",
])("keeps the explicit web reference %s intact beside ordinary web links", (href) => {
  const editor = createHeadlessEditor();
  editor.update(() => importMarkdownToLexical(`Before {{link('${href}')}} after https://outside.test.`), {
    discrete: true,
  });
  editor.read(() => {
    const paragraph = $getRoot().getFirstChild();
    if (!$isElementNode(paragraph)) throw new Error("Expected a paragraph");
    const references = paragraph.getChildren().filter((node) => node instanceof ReferenceLinkNode);
    expect(references).toHaveLength(1);
    expect(references[0]?.__href).toBe(href);
    expect(
      paragraph
        .getChildren()
        .filter((node) => node instanceof MarkdownLinkNode)
        .map((node) => node.getSource()),
    ).toEqual(["https://outside.test"]);
  });
});

test("preserves web reference source while editing surrounding Markdown", () => {
  const source = `Keep {{link("https://example.com")}} here.`;
  const document = createMarkdownSourceDocument(source);
  const editor = createHeadlessEditor();
  editor.update(() => document.importToLexical(), { discrete: true });
  editor.update(
    () => {
      $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === "Keep ")
        ?.setTextContent("Read ");
    },
    { discrete: true },
  );
  editor.read(() => expect(document.exportFromLexical($getRoot())).toBe(source.replace("Keep", "Read")));
});

test("keeps reference-looking text literal in code", () => {
  const editor = createHeadlessEditor();
  editor.update(() => importMarkdownToLexical("`{{link('https://example.com')}}`"), { discrete: true });
  editor.read(() => {
    const paragraph = $getRoot().getFirstChild();
    if (!$isElementNode(paragraph)) throw new Error("Expected a paragraph");
    expect(paragraph.getChildren().some((node) => node instanceof ReferenceLinkNode)).toBe(false);
    expect(paragraph.getTextContent()).toBe("{{link('https://example.com')}}");
  });
});

test("completes a streamed web reference and retains it as more text arrives", () => {
  const editor = createHeadlessEditor();
  const source = "Before {{link('https://example.com')}}";
  const update = (value: string) => editor.update(() => importStreamingMarkdownToLexical(value), { discrete: true });
  const reference = () =>
    editor.read(() => {
      const paragraph = $getRoot().getFirstChild();
      return $isElementNode(paragraph)
        ? paragraph.getChildren().find((node) => node instanceof ReferenceLinkNode)
        : undefined;
    });
  update("Before {{link('https://example.com");
  update(source);
  const key = reference()?.getKey();
  expect(key).toBeDefined();
  update(`${source} and more text`);
  expect(reference()?.getKey()).toBe(key);
});
