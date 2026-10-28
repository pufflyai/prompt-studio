import { expect, test } from "bun:test";
import { $getRoot, $isElementNode, createEditor, TextNode } from "lexical";
import { editorNodes } from "../../rich-text/shared/editor-config";
import { StreamingTextNode } from "../../rich-text/shared/nodes/streaming-text-node";
import { importStreamingMarkdownToLexical } from "../../rich-text/shared/streaming-markdown";
import { ChatCodeLinkNode } from "./chat-code-link-node";
import { resolveChatCodeLink } from "./chat-code-link-transform";

test("streamed file references remain links and retain earlier references", () => {
  const editor = createEditor({ nodes: [...editorNodes, ChatCodeLinkNode] });
  const transform = (node: TextNode) =>
    resolveChatCodeLink(
      node,
      {
        resolveHref: ({ source }) => `/file/${source}`,
        open: () => {},
      },
      "https://prompt.studio",
    );
  editor.registerNodeTransform(TextNode, transform);
  editor.registerNodeTransform(StreamingTextNode, transform);
  const update = (text: string, animate = true) =>
    editor.update(() => importStreamingMarkdownToLexical(text, undefined, animate), { discrete: true });
  const links = () =>
    editor.read(() => {
      const paragraph = $getRoot().getFirstChild();
      if (!$isElementNode(paragraph)) throw new Error("Expected a paragraph");
      return paragraph.getChildren().filter((node) => node instanceof ChatCodeLinkNode);
    });
  update("`src/a.ts`", false);
  const earlierKey = links()[0].getKey();
  update("`src/a.ts` and `src/b.ts`");
  expect(links().map((node) => node.__href)).toEqual(["/file/src/a.ts", "/file/src/b.ts"]);
  expect(links()[0].getKey()).toBe(earlierKey);
  expect(links().map((node) => node.__animateArrival)).toEqual([false, true]);
  update("`src/a.ts` and `src/c.ts`");
  expect(links().map((node) => node.__href)).toEqual(["/file/src/a.ts", "/file/src/c.ts"]);
  expect(links()[0].getKey()).toBe(earlierKey);
});
