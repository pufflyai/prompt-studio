import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { fetchSessionConversationMessages, resolveStreamEndMessages } from "./session-conversation-hydration";
import {
  applyMessagePatch,
  clearSessionStreamCache,
  getCachedSessionEntry,
  updateCachedSessionEntry,
} from "./session-stream-cache";

const originalFetch = globalThis.fetch;

const message = (id: string): SessionMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text: id }],
});

describe("applyMessagePatch", () => {
  it("replaces all messages when patch path is /messages", () => {
    const nextMessages = [message("m2"), message("m3")];

    const result = applyMessagePatch([message("m1")], {
      op: "replace",
      path: "/messages",
      value: nextMessages,
    });

    expect(result).toEqual(nextMessages);
  });

  it("adds all messages when patch path is /messages", () => {
    const nextMessages = [message("m2"), message("m3")];

    const result = applyMessagePatch([message("m1")], {
      op: "add",
      path: "/messages",
      value: nextMessages,
    });

    expect(result).toEqual(nextMessages);
  });

  it("preserves index-based patch behavior for /messages/<index>", () => {
    const result = applyMessagePatch([message("m1"), message("m3")], {
      op: "add",
      path: "/messages/1",
      value: message("m2"),
    });

    expect(result).toEqual([message("m1"), message("m2"), message("m3")]);
  });

  it("skips empty message parts and messages with no remaining parts for /messages patches", () => {
    const result = applyMessagePatch([], {
      op: "replace",
      path: "/messages",
      value: [
        { id: "m1", role: "assistant", parts: [{ type: "reasoning", text: "" }] },
        {
          id: "m2",
          role: "assistant",
          parts: [
            { type: "text", text: " " },
            { type: "tool", tool: "read" },
          ],
        },
      ],
    });

    expect(result).toEqual([{ id: "m2", role: "assistant", parts: [{ type: "tool", tool: "read" }] }]);
  });
});

describe("applyMessagePatch – reconnect replay", () => {
  it("keeps replayed history stable when patches are applied from an empty array", () => {
    let messages: SessionMessage[] = [];

    messages = applyMessagePatch(messages, { op: "add", path: "/messages/0", value: message("m1") });
    messages = applyMessagePatch(messages, { op: "add", path: "/messages/1", value: message("m2") });

    expect(messages).toEqual([message("m1"), message("m2")]);
  });
});

describe("session stream cache", () => {
  beforeEach(() => {
    clearSessionStreamCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("hydrates cached session messages when revisiting a session", () => {
    updateCachedSessionEntry("s_1", { messages: [message("m1")], status: "completed" });

    const snapshot = getCachedSessionEntry("s_1");

    expect(snapshot.messages).toEqual([message("m1")]);
    expect(snapshot.status).toBe("completed");
  });

  it("keeps separate snapshots per session", () => {
    updateCachedSessionEntry("s_1", { messages: [message("m1")], status: "completed" });
    updateCachedSessionEntry("s_2", { messages: [message("m2")], status: "failed" });

    expect(getCachedSessionEntry("s_1").messages).toEqual([message("m1")]);
    expect(getCachedSessionEntry("s_2").messages).toEqual([message("m2")]);
  });

  it("hydrates from conversation API and keeps hydrated messages on end when stream has no patches", async () => {
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ messages: [message("m-hydrated")] }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const hydrated = await fetchSessionConversationMessages("s_1");
    expect(hydrated).toEqual([message("m-hydrated")]);

    updateCachedSessionEntry("s_1", { messages: hydrated ?? [] });

    const finalMessages = resolveStreamEndMessages([], getCachedSessionEntry("s_1").messages);
    expect(finalMessages).toEqual([message("m-hydrated")]);
  });

  it("resolves messages from stream replay when end fires after patch", () => {
    // Simulates: stream sends patch (replay) then end for a completed session
    const replayed = [message("m1"), message("m2")];
    const streamedMessages = applyMessagePatch([], { op: "replace", path: "/messages", value: replayed });

    updateCachedSessionEntry("s_1", { messages: streamedMessages });

    const finalMessages = resolveStreamEndMessages(streamedMessages, getCachedSessionEntry("s_1").messages);
    expect(finalMessages).toEqual(replayed);
  });

  it("end handler uses cached hydrated messages when stream sends no patches and fetch resolved first", async () => {
    // Simulates: conversation fetch resolves BEFORE end event, no patch events fired
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ messages: [message("m-hydrated")] }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const hydrated = await fetchSessionConversationMessages("s_1");
    updateCachedSessionEntry("s_1", { messages: hydrated ?? [] });

    // end fires with no streamed messages — should resolve to hydrated messages
    const streamedMessages: SessionMessage[] = [];
    const finalMessages = resolveStreamEndMessages(streamedMessages, getCachedSessionEntry("s_1").messages);
    expect(finalMessages).toEqual([message("m-hydrated")]);
  });

  it("end handler returns empty when stream sends no patches and fetch has not resolved yet", () => {
    // Simulates: end fires BEFORE conversation fetch resolves, no patch events, empty cache
    const streamedMessages: SessionMessage[] = [];
    const cachedMessages = getCachedSessionEntry("s_1").messages; // empty — fetch hasn't resolved

    const finalMessages = resolveStreamEndMessages(streamedMessages, cachedMessages);
    expect(finalMessages).toEqual([]);
  });

  it("falls back gracefully when conversation hydration request fails", async () => {
    const fetchMock = mock(async () => {
      return new Response("boom", { status: 500 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const hydrated = await fetchSessionConversationMessages("s_1");
    expect(hydrated).toBeNull();
  });
});
