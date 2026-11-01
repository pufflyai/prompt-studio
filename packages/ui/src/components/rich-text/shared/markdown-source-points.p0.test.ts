import { expect, test } from "bun:test";
import { $getRoot } from "lexical";
import { createMarkdownSourceDocument } from "./markdown-source-document";
import { createMarkdownSourcePoints } from "./markdown-source-points";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

test("source points distinguish repeated link labels, Markdown delimiters and escaped spelling", () => {
  const source = "First __same__ and [same](same).\r\n\r\nLast \\*same\\* 😀.";
  const editor = createHeadlessEditor();
  const document = createMarkdownSourceDocument(source);
  editor.update(() => document.importToLexical(), { discrete: true });
  editor.read(() => {
    const root = $getRoot();
    const mapping = createMarkdownSourcePoints(root, source);
    const nodes = root.getAllTextNodes().filter((node) => node.getTextContent() === "same");
    expect(nodes).toHaveLength(2);
    for (const [index, expected] of [source.indexOf("__same__") + 2, source.indexOf("[same]") + 1].entries()) {
      const point = { key: nodes[index]!.getKey(), offset: 2, type: "text" as const };
      expect(mapping.toSource(point)).toBe(expected + 2);
      expect(mapping.toPoint(expected + 2)).toEqual(point);
    }
    const last = root.getAllTextNodes().at(-1)!;
    const local = last.getTextContent().indexOf("😀") + 2;
    expect(mapping.toSource({ key: last.getKey(), offset: local, type: "text" })).toBe(source.indexOf("😀") + 2);
  });
});

test("code selections map into the exact source fence without altering the editor", () => {
  const source = "~~~ts\r\nconst value = `same`;\r\n~~~";
  const editor = createHeadlessEditor();
  const document = createMarkdownSourceDocument(source);
  editor.update(() => document.importToLexical(), { discrete: true });
  editor.read(() => {
    const root = $getRoot();
    const before = editor.getEditorState().toJSON();
    const mapping = createMarkdownSourcePoints(root, source);
    const node = root.getAllTextNodes()[0]!;
    const point = { key: node.getKey(), offset: 6, type: "text" as const };
    expect(mapping.toSource(point)).toBe(source.indexOf("const") + 6);
    expect(mapping.toPoint(source.indexOf("const") + 6)).toEqual(point);
    expect(editor.getEditorState().toJSON()).toEqual(before);
  });
});

test("element selection boundaries map to their own child or last text position", () => {
  const source = "first\n\nsecond";
  const editor = createHeadlessEditor();
  const document = createMarkdownSourceDocument(source);
  editor.update(() => document.importToLexical(), { discrete: true });
  editor.read(() => {
    const root = $getRoot();
    const mapping = createMarkdownSourcePoints(root, source);
    expect(mapping.toSource({ key: root.getKey(), type: "element", offset: 0 })).toBe(0);
    expect(mapping.toSource({ key: root.getKey(), type: "element", offset: 1 })).toBe(7);
    expect(mapping.toSource({ key: root.getFirstChild()!.getKey(), type: "element", offset: 1 })).toBe(5);
  });
});

test("decorator-only blocks retain element caret positions before and after their source", () => {
  for (const block of ["![alt](image.png)", "{{link('PS-1')}}", "---"]) {
    const source = `${block}\n\nLast text.`;
    const editor = createHeadlessEditor();
    const document = createMarkdownSourceDocument(source);
    editor.update(() => document.importToLexical(), { discrete: true });
    editor.read(() => {
      const root = $getRoot();
      const first = root.getFirstChild()!;
      const mapping = createMarkdownSourcePoints(root, source);
      expect(mapping.toSource({ key: root.getKey(), type: "element", offset: 0 })).toBe(0);
      expect(mapping.toPoint(0)).not.toEqual({ key: root.getAllTextNodes().at(-1)!.getKey(), type: "text", offset: 0 });
      if (first.getType() === "paragraph") {
        expect(mapping.toSource({ key: first.getKey(), type: "element", offset: 0 })).toBe(0);
        expect(mapping.toSource({ key: first.getKey(), type: "element", offset: 1 })).toBe(block.length);
      }
    });
  }
});

test("an empty code block caret maps inside its original fence", () => {
  const source = "~~~ts\r\n\r\n~~~\r\n\r\nLast text.";
  const editor = createHeadlessEditor();
  const document = createMarkdownSourceDocument(source);
  editor.update(() => document.importToLexical(), { discrete: true });
  editor.read(() => {
    const root = $getRoot();
    const code = root.getFirstChild()!;
    const mapping = createMarkdownSourcePoints(root, source);
    expect(mapping.toSource({ key: code.getKey(), type: "element", offset: 0 })).toBe(7);
    expect(mapping.toPoint(7)).toEqual({ key: code.getKey(), type: "element", offset: 0 });
  });
});
