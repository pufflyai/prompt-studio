import { describe, expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { applyMessagePatch } from "./session-chat";

const message = (id: string, text: string): SessionMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text }],
});

describe("applyMessagePatch", () => {
  test("adds indexed stream messages", () => {
    expect(
      applyMessagePatch([message("1", "first")], { op: "add", path: "/messages/1", value: message("2", "second") }),
    ).toEqual([message("1", "first"), message("2", "second")]);
  });

  test("replaces indexed stream messages", () => {
    expect(
      applyMessagePatch([message("1", "first")], {
        op: "replace",
        path: "/messages/0",
        value: message("1", "updated"),
      }),
    ).toEqual([message("1", "updated")]);
  });

  test("removes indexed stream messages", () => {
    expect(
      applyMessagePatch([message("1", "first"), message("2", "second")], { op: "remove", path: "/messages/0" }),
    ).toEqual([message("2", "second")]);
  });
});
