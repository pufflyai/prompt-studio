import { describe, expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { splitQueuedFollowUps } from "./queued-follow-ups";

const userMessage = (id: string, text: string): SessionMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

describe("splitQueuedFollowUps", () => {
  test("splits queued prompt messages from transcript messages", () => {
    const queued = userMessage("queued-prompt-session-1-2", "Run the follow-up");
    const transcript = userMessage("message-1", "Start work");

    expect(splitQueuedFollowUps([transcript, queued], "session-1")).toEqual({
      messages: [transcript],
      queuedFollowUps: [{ id: queued.id, prompt: "Run the follow-up", position: 2, attachments: [] }],
    });
  });

  test("keeps non-user or non-matching queued ids in the transcript", () => {
    const assistantQueuedId: SessionMessage = {
      id: "queued-prompt-session-1-1",
      role: "assistant",
      parts: [{ type: "text", text: "Not a queued prompt" }],
    };
    const otherSessionQueuedId = userMessage("queued-prompt-session-2-1", "Other session");

    expect(splitQueuedFollowUps([assistantQueuedId, otherSessionQueuedId], "session-1")).toEqual({
      messages: [assistantQueuedId, otherSessionQueuedId],
      queuedFollowUps: [],
    });
  });
});
