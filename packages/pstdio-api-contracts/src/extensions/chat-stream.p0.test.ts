import { expect, test } from "bun:test";
import type { ChatRendererEvent } from "./chat-renderer";
import { chatRendererStreamFrames, createChatRendererStreamDecoder } from "./chat-stream";

const large = (): ChatRendererEvent => ({
  revision: Number.MAX_SAFE_INTEGER,
  snapshot: {
    messages: [{ id: "large", role: "assistant", parts: [{ type: "text", text: '🙂\n"\\'.repeat(24_000) }] }],
  },
});
const decode = (frames: unknown[]) => {
  const reader = createChatRendererStreamDecoder();
  let result: ChatRendererEvent | undefined;
  for (const frame of frames) result = reader.decode(JSON.parse(JSON.stringify(frame)));
  reader.finish();
  return result;
};

test("large logical updates are lossless, atomic and bounded with worst-size envelopes", () => {
  const event = large();
  const frames = [...chatRendererStreamFrames(event)];
  expect(frames.length).toBeGreaterThan(1);
  for (const frame of frames)
    expect(new TextEncoder().encode(JSON.stringify(frame)).byteLength).toBeLessThanOrEqual(64 * 1024);
  expect(decode(frames)).toEqual(event);
  const recovery: ChatRendererEvent = {
    revision: 1,
    recoverDraft: { text: "x".repeat(80 * 1024), attachments: [], values: {} },
  };
  expect(decode([...chatRendererStreamFrames(recovery)])).toEqual(recovery);
});

test("the 64 KiB boundary passes small events unchanged and frames only larger logical updates", () => {
  const event = (text: string) => ({ revision: 0, snapshot: { notice: text } });
  const overhead = new TextEncoder().encode(JSON.stringify(event(""))).byteLength;
  const exact = event("x".repeat(64 * 1024 - overhead));
  expect([...chatRendererStreamFrames(exact)]).toEqual([exact]);
  expect([...chatRendererStreamFrames(event(`${exact.snapshot!.notice}x`))].length).toBeGreaterThan(1);
});

test("UTF-8 is decoded only after a complete event, including a codepoint split across frames", () => {
  let split = false;
  for (let padding = 0; padding < 4; padding++) {
    const event: ChatRendererEvent = {
      revision: 1,
      snapshot: { notice: `${"a".repeat(padding)}${"🙂".repeat(24_000)}` },
    };
    const frames = [...chatRendererStreamFrames(event)];
    const first = frames[0]!;
    if (!("fragment" in first)) throw new Error("Expected framed event");
    const bytes = Uint8Array.from(atob(first.fragment.data), (character) => character.charCodeAt(0));
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      split = true;
      expect(decode(frames)).toEqual(event);
      break;
    }
  }
  expect(split).toBe(true);
});

test("malformed, interleaved and incomplete events fail without retaining a partial event", () => {
  const frames = [...chatRendererStreamFrames(large())];
  const fragment = (index: number) => {
    const frame = structuredClone(frames[index]!);
    if (!("fragment" in frame)) throw new Error("Expected framed event");
    return frame;
  };
  const wrongLength = fragment(1);
  wrongLength.fragment.byteLength++;
  const wrongCount = fragment(1);
  wrongCount.fragment.count++;
  const shortPart = fragment(0);
  shortPart.fragment.data = "AA==";
  const invalidBase64 = fragment(0);
  invalidBase64.fragment.data = "!!!!";
  const noncanonical = fragment(0);
  noncanonical.fragment.data = `AB==${noncanonical.fragment.data.slice(4)}`;
  const wrongRevision = frames.map((frame) => ({ ...frame, revision: frame.revision - 1 }));
  const small: ChatRendererEvent = { revision: 0, snapshot: {} };
  const malformed: unknown[][] = [
    [frames[1]],
    [frames[0], frames[0]],
    [frames[0], frames[2]],
    [frames[0], small],
    [frames[0], wrongLength],
    [frames[0], wrongCount],
    [shortPart],
    [invalidBase64],
    [noncanonical],
    wrongRevision,
    [
      ...frames.slice(0, -1),
      { ...fragment(frames.length - 1), fragment: { ...fragment(frames.length - 1).fragment, data: "AA==" } },
    ],
  ];
  for (const input of malformed) {
    const reader = createChatRendererStreamDecoder();
    expect(() => {
      for (const frame of input) reader.decode(frame);
    }).toThrow();
    expect(reader.decode(small)).toEqual(small);
  }
  const reader = createChatRendererStreamDecoder();
  expect(reader.decode(frames[0])).toBeUndefined();
  expect(() => reader.finish()).toThrow("incomplete");
  expect(reader.decode(small)).toEqual(small);
});

test("completed frames still require valid UTF-8, JSON and a matching logical event", () => {
  const packet = (text: string, data = btoa(text)) => ({
    revision: 0,
    fragment: { index: 0, count: 1, byteLength: atob(data).length, data },
  });
  const nested = packet(JSON.stringify(packet("{}")));
  for (const frame of [packet("", "/w=="), packet("{"), packet("{}"), nested]) {
    const reader = createChatRendererStreamDecoder();
    expect(() => reader.decode(frame)).toThrow();
    expect(reader.decode({ revision: 0, snapshot: {} })).toEqual({ revision: 0, snapshot: {} });
  }
});
