import { beforeEach, describe, expect, it } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import {
  applyMessagePatch,
  clearSessionStreamCache,
  getCachedSessionEntry,
  updateCachedSessionEntry,
} from "./session-stream-cache";

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
});
