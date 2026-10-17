import { expect, test } from "bun:test";
import { $getRoot, $isElementNode, createEditor, TextNode } from "lexical";
import { editorNodes } from "../../rich-text/shared/editor-config";
import { importMarkdownToLexical } from "../../rich-text/shared/markdown-import";
import { StreamingTextNode } from "../../rich-text/shared/nodes/streaming-text-node";
import { importStreamingMarkdownToLexical } from "../../rich-text/shared/streaming-markdown";
import { ChatResourceLinkNode } from "./chat-resource-link-node";
import { resolveChatTextLinks } from "./chat-text-link-transform";

const pathEditor = () => {
  const editor = createEditor({ nodes: [...editorNodes, ChatResourceLinkNode] });
  editor.registerNodeTransform(TextNode, resolveChatTextLinks);
  editor.registerNodeTransform(StreamingTextNode, resolveChatTextLinks);
  const links = () =>
    editor.read(() => {
      const paragraph = $getRoot().getFirstChild();
      if (!$isElementNode(paragraph)) throw new Error("Expected a paragraph");
      return paragraph.getChildren().filter((node) => node instanceof ChatResourceLinkNode);
    });
  return { editor, links };
};

test("recognizes ordinary file paths in prose without agent link formatting", () => {
  const { editor, links } = pathEditor();
  const paths = [
    ".pstdio/extension-storage/planner/tickets/T-1/ticket.md",
    "README.md",
    "./src/app.ts:12:4",
    "/workspace/project/src/app.ts#L2-L4",
    "C:\\project\\src\\app.ts",
    "$PROJECT/src/app.ts",
    "file:///workspace/project/notes.md",
    "./LICENSE",
  ];
  const source = `Review ${paths.join(", ")}. Then continue.`;
  editor.update(() => importMarkdownToLexical(source), { discrete: true });
  expect(links().map((node) => node.__candidate)).toEqual(paths.map((path) => ({ source: path, origin: "text" })));
  editor.read(() => expect($getRoot().getTextContent()).toBe(source));
});

test("keeps prose, versions, code blocks, and web link labels intact", () => {
  const { editor, links } = pathEditor();
  editor.update(
    () =>
      importMarkdownToLexical(
        "Use and/or, v1.2.3, e.g. a choice, and [docs/file.md](https://example.com).\n\n```txt\nsrc/app.ts\n```",
      ),
    { discrete: true },
  );
  expect(links()).toHaveLength(0);
  editor.read(() => expect($getRoot().getTextContent()).toContain("src/app.ts"));
});

test("plain path bubbles complete across streamed chunks and retain their identity", () => {
  const { editor, links } = pathEditor();
  const update = (source: string) => editor.update(() => importStreamingMarkdownToLexical(source), { discrete: true });
  update("Review src/app.");
  update("Review src/app.ts");
  expect(links().map((node) => node.__candidate.source)).toEqual(["src/app.ts"]);
  const firstKey = links()[0]?.getKey();
  update("Review src/app.ts, then README.md.");
  expect(links().map((node) => node.__candidate.source)).toEqual(["src/app.ts", "README.md"]);
  expect(links()[0]?.getKey()).toBe(firstKey);
  update("Review src/app.tsx, then README.md.");
  expect(links().map((node) => node.__candidate.source)).toEqual(["src/app.tsx", "README.md"]);
  expect(links()[0]?.getKey()).not.toBe(firstKey);
});

test.each([
  ["src/app/(dashboard)/page.ts", "src/app/(dashboard)/page.ts"],
  ["(src/app/(dashboard)/page.ts)", "src/app/(dashboard)/page.ts"],
  ["src/app/(dash(board))/page.ts:12:4", "src/app/(dash(board))/page.ts:12:4"],
  ["(dashboard)/page.ts", "(dashboard)/page.ts"],
  ["src/app/(dashboard)/page.ts)", "src/app/(dashboard)/page.ts"],
  ["src/app/[id]/page.ts", "src/app/[id]/page.ts"],
])("preserves the complete plain path in %s", (text, path) => {
  const { editor, links } = pathEditor();
  const source = `Read ${text}. Then continue.`;
  editor.update(() => importMarkdownToLexical(source), { discrete: true });
  expect(links().map((node) => node.__candidate.source)).toEqual([path]);
  editor.read(() => expect($getRoot().getTextContent()).toBe(source));
});

test("does not link fragments of paths with mismatched delimiters", () => {
  const { editor, links } = pathEditor();
  editor.update(() => importMarkdownToLexical("Read src/app/(dashboard]/page.ts."), { discrete: true });
  expect(links()).toHaveLength(0);
});

test("route-group paths stream into a complete bubble without changing the target", () => {
  const { editor, links } = pathEditor();
  const update = (source: string) => editor.update(() => importStreamingMarkdownToLexical(source), { discrete: true });
  update("Read src/app/(dashboard)/pa");
  expect(links()).toHaveLength(0);
  update("Read src/app/(dashboard)/page.ts");
  expect(links().map((node) => node.__candidate.source)).toEqual(["src/app/(dashboard)/page.ts"]);
  const key = links()[0]?.getKey();
  update("Read src/app/(dashboard)/page.ts. Then continue.");
  expect(links()[0]?.getKey()).toBe(key);
});
