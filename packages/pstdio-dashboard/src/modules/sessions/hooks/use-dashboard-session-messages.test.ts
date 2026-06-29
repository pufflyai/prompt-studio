import { describe, expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { nextStateForConnectionStart } from "./use-dashboard-session-messages";

const message = (id: string): SessionMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text: id }],
});

describe("nextStateForConnectionStart", () => {
  test("preserves the rendered conversation across a same-session reconnect", () => {
    const next = nextStateForConnectionStart({
      current: { messages: [message("a"), message("b")], loading: false, streaming: true },
      isSessionChange: false,
    });

    expect(next.messages).toEqual([message("a"), message("b")]);
    expect(next.loading).toBe(true);
    expect(next.streaming).toBe(false);
  });

  test("clears the message list when the session itself changes", () => {
    const next = nextStateForConnectionStart({
      current: { messages: [message("a")], loading: false, streaming: false },
      isSessionChange: true,
    });

    expect(next.messages).toEqual([]);
    expect(next.loading).toBe(true);
    expect(next.streaming).toBe(false);
  });
});
