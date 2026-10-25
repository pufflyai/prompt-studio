import { expect, test } from "bun:test";
import { normalizeChatMessagesForDisplay, type SessionMessage, type ToolPart } from "../components/message-types";
import { capturedChatImageSource, emptyChatImageSources, indexChatImageSources } from "./chat-image-sources";
import type { ChatLinkHandler } from "./chat-link";

const image = (source: string, src: string): ToolPart => ({
  type: "tool",
  tool: "view_image",
  status: "completed",
  state: { output: [{ type: "image", source, src, mimeType: "image/png" }] },
});
const first = "data:image/png;base64,aGVsbG8=";
const second = "data:image/png;base64,d29ybGQ=";

test("text and command updates preserve the empty image history", () => {
  const answer = { type: "text" as const, text: "First chunk" };
  const history = indexChatImageSources([{ id: "answer", role: "assistant", parts: [answer] }]);
  const updated = indexChatImageSources([
    { id: "answer", role: "assistant", parts: [{ ...answer, text: "Second chunk" }] },
    { id: "command", role: "tool", parts: [{ type: "tool", tool: "bash", state: { output: "Files" } }] },
  ]);
  expect(updated).toBe(history);
  const capture = image("/tmp/preview.png", first);
  expect(indexChatImageSources([{ id: "capture", role: "tool", parts: [capture] }]).get(capture)?.size).toBe(1);
  expect(history.get(capture)).toBeUndefined();
});

test("unsafe captures keep the empty history and later captures cannot change earlier text", () => {
  const earlier = { type: "text" as const, text: "Before capture" };
  const unsafe = image("/tmp/preview.png", "javascript:alert(1)");
  const empty = indexChatImageSources([{ id: "unsafe", role: "assistant", parts: [earlier, unsafe] }]);
  expect(empty).toBe(indexChatImageSources([]));
  const capture = image("/tmp/preview.png", first);
  const later = { ...earlier, text: "After capture" };
  const history = indexChatImageSources([{ id: "capture", role: "assistant", parts: [earlier, capture, later] }]);
  expect(capturedChatImageSource(history.get(earlier) ?? emptyChatImageSources, "/tmp/preview.png")).toBeUndefined();
  expect(capturedChatImageSource(history.get(later)!, "/tmp/preview.png")).toBe(first);
  expect(empty.get(later)).toBeUndefined();
});

test("matches a captured absolute path with a relative workspace reference", () => {
  const handler: ChatLinkHandler = {
    resolveHref: ({ source }) => `workspace://${source.replace(/^\/workspace\//, "")}`,
    open: () => {},
  };
  const answer = { type: "text" as const, text: "Preview" };
  const history = indexChatImageSources(
    [
      {
        id: "image",
        role: "assistant",
        parts: [image("/workspace/screenshots/preview.png", first), answer],
      },
    ],
    handler,
  );
  expect(capturedChatImageSource(history.get(answer)!, "screenshots/preview.png", handler)).toBe(first);
});

test("resolves an encoded local Markdown image from captured tool output after reload", () => {
  const answer = { type: "text" as const, text: "Preview" };
  const history = indexChatImageSources([
    {
      id: "image",
      role: "assistant",
      parts: [image("/tmp/long question.png", first), answer],
    },
  ]);
  expect(capturedChatImageSource(history.get(answer)!, "/tmp/long%20question.png")).toBe(first);
  expect(capturedChatImageSource(history.get(answer)!, "javascript:alert(1)")).toBeUndefined();
});

test("keeps each response tied to its preceding capture through display normalization", () => {
  const messages: SessionMessage[] = [
    { id: "capture-1", role: "assistant", parts: [image("/tmp/preview.png", first)] },
    { id: "answer-1", role: "assistant", parts: [{ type: "text", text: "First" }] },
    { id: "capture-2", role: "assistant", parts: [image("/tmp/preview.png", second)] },
    { id: "answer-2", role: "assistant", parts: [{ type: "text", text: "Second" }] },
  ];
  const history = indexChatImageSources(messages);
  const displayed = normalizeChatMessagesForDisplay(messages);
  const firstAnswer = displayed[0].parts.at(-1)!;
  const secondAnswer = displayed[1].parts.at(-1)!;
  expect(capturedChatImageSource(history.get(firstAnswer)!, "/tmp/preview.png")).toBe(first);
  expect(capturedChatImageSource(history.get(secondAnswer)!, "/tmp/preview.png")).toBe(second);
});

test("ignores unsafe captured sources while keeping the preceding safe image", () => {
  const answer = { type: "text" as const, text: "Preview" };
  const history = indexChatImageSources([
    {
      id: "image",
      role: "assistant",
      parts: [image("/tmp/preview.png", first), image("/tmp/preview.png", "javascript:alert(1)"), answer],
    },
  ]);
  expect(capturedChatImageSource(history.get(answer)!, "/tmp/preview.png")).toBe(first);
});
