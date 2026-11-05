import { expect, test } from "bun:test";
import { conversationState } from "./conversation-state";

test("queue rows carry original revisions and files, and do not duplicate the transcript", () => {
  const state = conversationState(
    "s",
    [
      { id: "answer", role: "assistant", parts: [{ type: "text", text: "answer" }] },
      {
        id: "queued-prompt-s-7",
        role: "user",
        parts: [
          { type: "text", text: "next" },
          { type: "file", fileId: "file", filename: "notes", url: "file-url" },
        ],
      },
    ],
    {
      activeRunStartedAt: "run",
      steeringAvailable: true,
      steeringUnavailableReason: null,
      requests: [
        {
          queuePosition: 7,
          revision: "r7",
          prompt: "next",
          model: null,
          params: {},
          attachments: [{ file_id: "file" }],
          steeringDelivery: null,
        },
      ],
    },
  );
  expect(state.messages.map((m) => m.id)).toEqual(["answer"]);
  expect(state.queuedFollowUps[0]).toMatchObject({
    position: 7,
    revision: "r7",
    attachments: [{ id: "file", name: "notes", url: "file-url" }],
  });
});

test("accepted steering uses its native delivery identity exactly once", () => {
  const state = conversationState(
    "s",
    [
      { id: "delivery", role: "user", parts: [{ type: "text", text: "next" }] },
      { id: "queued-prompt-s-2", role: "user", parts: [{ type: "text", text: "next" }] },
    ],
    {
      activeRunStartedAt: "run",
      steeringAvailable: true,
      steeringUnavailableReason: null,
      requests: [
        {
          queuePosition: 2,
          revision: "r",
          prompt: "next",
          model: null,
          params: {},
          attachments: [],
          steeringDelivery: { id: "delivery", runStartedAt: "run" },
        },
      ],
    },
  );
  expect(state.messages.map((m) => m.id)).toEqual(["delivery"]);
  expect(state.queuedFollowUps).toEqual([]);
});

test("steering handoff keeps attachments until native confirmation includes them", () => {
  const file = { type: "file" as const, fileId: "A", filename: "A.txt", url: "/A" };
  const state = conversationState(
    "s",
    [
      { id: "delivery", role: "user", parts: [{ type: "text", text: "next" }] },
      { id: "queued-prompt-s-2", role: "user", parts: [{ type: "text", text: "next" }, file] },
    ],
    {
      activeRunStartedAt: "run",
      steeringAvailable: true,
      steeringUnavailableReason: null,
      requests: [
        {
          queuePosition: 2,
          revision: "r",
          prompt: "next",
          model: null,
          params: {},
          attachments: [{ file_id: "A" }],
          steeringDelivery: { id: "delivery", runStartedAt: "run" },
        },
      ],
    },
  );
  expect(state.messages).toHaveLength(1);
  expect(state.messages[0].parts).toContainEqual(file);
});
