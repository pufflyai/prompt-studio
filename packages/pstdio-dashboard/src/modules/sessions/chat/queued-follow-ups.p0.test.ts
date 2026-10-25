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

test("a delayed queue snapshot cannot restore a correlated delivered message beside its transcript entry", () => {
  const request = {
    queuePosition: 2,
    revision: "saved",
    prompt: "repeat",
    model: "one",
    params: {},
    attachments: [],
    steeringDelivery: { id: "delivery", runStartedAt: "run" },
  };
  const queue = {
    requests: [request],
    activeRunStartedAt: "run",
    steeringAvailable: true,
    steeringUnavailableReason: null,
  };
  const queued = userMessage("queued-prompt-session-1-2", "repeat");
  const delivered = userMessage("delivery", "repeat");
  expect(splitQueuedFollowUps([delivered, queued], "session-1", queue)).toEqual({
    messages: [delivered],
    queuedFollowUps: [],
  });
  expect(
    splitQueuedFollowUps([userMessage("other", "repeat"), queued], "session-1", queue).queuedFollowUps,
  ).toHaveLength(1);
  expect(
    splitQueuedFollowUps([delivered, queued], "session-1", {
      ...queue,
      requests: [{ ...request, attachments: [{ file_id: "missing" }] }],
    }).queuedFollowUps,
  ).toHaveLength(1);
});
