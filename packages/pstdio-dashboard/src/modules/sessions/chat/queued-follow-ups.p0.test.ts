import { describe, expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { splitQueuedFollowUps } from "./queued-follow-ups";

const userMessage = (id: string, text: string): SessionMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

describe("splitQueuedFollowUps", () => {
  test("preserves the submitted text when a saved request becomes a live message", () => {
    const text = "\nCorrection\n";
    const queued = userMessage("queued-prompt-session-1-2", text);
    expect(splitQueuedFollowUps([queued], "session-1").queuedFollowUps[0].prompt).toBe(text);
  });
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
  expect(splitQueuedFollowUps([userMessage("other", "repeat"), queued], "session-1", queue)).toEqual({
    messages: [userMessage("other", "repeat"), userMessage("delivery", "repeat")],
    queuedFollowUps: [],
  });
  expect(
    splitQueuedFollowUps([delivered, queued], "session-1", {
      ...queue,
      requests: [{ ...request, attachments: [{ file_id: "missing" }] }],
    }).queuedFollowUps,
  ).toHaveLength(0);
});

test("live handoffs appear as sent messages and return to the queue after rejection", () => {
  const initial = userMessage("initial", "Start work");
  const queued = {
    ...userMessage("queued-prompt-session-1-2", "Use the attached notes"),
    parts: [
      { type: "text" as const, text: "Use the attached notes" },
      { type: "file" as const, fileId: "notes", filename: "notes.txt", url: "/notes" },
    ],
  };
  const request = {
    queuePosition: 2,
    revision: "saved",
    prompt: "Use the attached notes",
    model: "one",
    params: {},
    attachments: [{ file_id: "notes", name: "notes.txt", url: "/notes", mime_type: "text/plain", size_bytes: 4 }],
    steeringDelivery: { id: "delivery", runStartedAt: "run" },
  };
  const queue = {
    requests: [request],
    activeRunStartedAt: "run",
    steeringAvailable: true,
    steeringUnavailableReason: null,
  };
  const optimistic = { ...queued, id: "delivery" };
  expect(splitQueuedFollowUps([initial, queued], "session-1", queue)).toEqual({
    messages: [initial, optimistic],
    queuedFollowUps: [],
  });
  expect(splitQueuedFollowUps([initial, optimistic, queued], "session-1", queue)).toEqual({
    messages: [initial, optimistic],
    queuedFollowUps: [],
  });
  const rejected = splitQueuedFollowUps([initial, queued], "session-1", {
    ...queue,
    requests: [{ ...request, steeringDelivery: null }],
  });
  expect(rejected.messages).toEqual([initial]);
  expect(rejected.queuedFollowUps.map((item) => ({ id: item.id, attachments: item.attachments }))).toEqual([
    {
      id: queued.id,
      attachments: [{ id: "notes", name: "notes.txt", url: "/notes", mediaType: undefined, size: undefined }],
    },
  ]);
  const partial = splitQueuedFollowUps([initial, userMessage("delivery", request.prompt), queued], "session-1", queue);
  expect(partial.messages).toEqual([initial, optimistic]);
  expect(partial.queuedFollowUps).toEqual([]);
});
