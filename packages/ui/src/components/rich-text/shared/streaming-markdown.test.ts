import { expect, test } from "bun:test";
import { $getRoot, $isElementNode, $isTextNode, createEditor } from "lexical";
import { ChatCodeLinkNode } from "../../chat-ui/links/chat-code-link-node";
import { ChatResourceLinkNode } from "../../chat-ui/links/chat-resource-link-node";
import { editorNodes } from "./editor-config";
import { MarkdownLinkNode } from "./nodes/MarkdownLinkNode";
import { importStreamingMarkdownToLexical } from "./streaming-markdown";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

test("completed resource bubbles keep their identity while more text streams", () => {
  const editor = createEditor({ nodes: [...editorNodes, ChatResourceLinkNode] });
  editor.registerNodeTransform(MarkdownLinkNode, (node) => {
    node.replace(new ChatResourceLinkNode({ source: node.getSource(), origin: "markdown" }, node.getTextContent()));
  });
  const update = (text: string) => editor.update(() => importStreamingMarkdownToLexical(text), { discrete: true });
  const firstLink = () =>
    editor.read(() => {
      const paragraph = $getRoot().getFirstChild();
      return $isElementNode(paragraph) ? paragraph.getFirstChild() : null;
    });
  update("[Ticket](tickets/T-1.md)");
  const key = firstLink()?.getKey();
  update("[Ticket](tickets/T-1.md) and more text");
  expect(firstLink()?.getKey()).toBe(key);
  update("[Other](tickets/T-2.md) and more text");
  expect(firstLink()).toBeInstanceOf(ChatResourceLinkNode);
  expect(firstLink()?.getKey()).not.toBe(key);
});

test("streamed chunks retain earlier text nodes and completed blocks", () => {
  const editor = createHeadlessEditor();
  const update = (text: string, animate = true) =>
    editor.update(() => importStreamingMarkdownToLexical(text, undefined, animate), { discrete: true });
  update("Earlier paragraph.\n\nHello", false);
  const initial = editor.read(() =>
    $getRoot()
      .getChildren()
      .map((node) => ({ key: node.getKey(), textKeys: $isElementNode(node) ? node.getChildrenKeys() : [] })),
  );
  update("Earlier paragraph.\n\nHello world");
  editor.read(() => {
    const blocks = $getRoot().getChildren();
    expect(blocks.map((node) => node.getKey())).toEqual(initial.map((node) => node.key));
    const paragraph = blocks[1];
    expect($isElementNode(paragraph)).toBe(true);
    if (!$isElementNode(paragraph)) return;
    expect(paragraph.getFirstChild()?.getKey()).toBe(initial[1].textKeys[0]);
    expect(paragraph.getChildren().map((node) => node.getTextContent())).toEqual(["Hello", " world"]);
    expect(paragraph.getLastChild()?.exportJSON().type).toBe("streaming-text");
  });
  update("Earlier paragraph.\n\nHello world again", false);
  editor.read(() => expect($getRoot().getTextContent()).toBe("Earlier paragraph.\n\nHello world again"));
});

test("markdown can complete emphasis, lists, and code fences during a stream", () => {
  const editor = createHeadlessEditor();
  for (const text of [
    "Stable.\n\n**new",
    "Stable.\n\n**new text**",
    "Stable.\n\n**new text**\n\n- first",
    "Stable.\n\n**new text**\n\n- first\n- second\n\n```ts\nconst x = 1;",
    "Stable.\n\n**new text**\n\n- first\n- second\n\n```ts\nconst x = 1;\n```",
  ]) {
    editor.update(() => importStreamingMarkdownToLexical(text), { discrete: true });
  }
  editor.read(() => {
    expect(
      $getRoot()
        .getChildren()
        .map((node) => node.getType()),
    ).toEqual(["paragraph", "paragraph", "list", "code"]);
    expect($getRoot().getTextContent()).toContain("const x = 1;");
  });
});

test("inline file links keep their targets when markdown changes", () => {
  const editor = createEditor({ nodes: [...editorNodes, ChatCodeLinkNode] });
  editor.update(
    () => {
      importStreamingMarkdownToLexical("`src/a.ts`", undefined, false);
      const paragraph = $getRoot().getFirstChild();
      if (!$isElementNode(paragraph)) throw new Error("Expected a paragraph");
      paragraph.getFirstChildOrThrow().replace(new ChatCodeLinkNode("src/a.ts", "/file/src/a.ts").setFormat("code"));
    },
    { discrete: true },
  );
  editor.update(() => importStreamingMarkdownToLexical("`src/b.ts`"), { discrete: true });
  editor.read(() => {
    const paragraph = $getRoot().getFirstChild();
    const node = $isElementNode(paragraph) ? paragraph.getFirstChild() : null;
    expect(node?.getTextContent()).toBe("src/b.ts");
    // The chat link transform must receive a new code node to resolve the new target.
    expect(node).not.toBeInstanceOf(ChatCodeLinkNode);
    expect($isTextNode(node) && node.hasFormat("code")).toBe(true);
  });
});
