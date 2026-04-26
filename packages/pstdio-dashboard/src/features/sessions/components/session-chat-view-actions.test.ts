import { describe, expect, test } from "bun:test";
import type { Dispatch, SetStateAction } from "react";
import type { PendingFollowUpState } from "./session-chat-state";
import { type FollowUpMutation, submitSessionMessage } from "./session-chat-view-actions";

describe("submitSessionMessage", () => {
  test("passes question responses to follow-up without adding an optimistic user follow-up", () => {
    const followUpInputs: Array<Parameters<FollowUpMutation["mutate"]>[0]> = [];
    let pendingFollowUp: PendingFollowUpState | null = null;
    const pendingUpdates: Array<PendingFollowUpState | null> = [];
    const setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>> = (value) => {
      pendingFollowUp = typeof value === "function" ? value(pendingFollowUp) : value;
      pendingUpdates.push(pendingFollowUp);
    };

    submitSessionMessage({
      sessionId: "session-1",
      projectId: "project-1",
      agent: "opencode",
      model: undefined,
      text: "What's the weather like?: Nice",
      attachments: [],
      questionResponse: { answers: [["Nice"]] },
      messages: [],
      pendingIdRef: { current: 0 },
      clearSessionDraft: () => {},
      setChatDraft: () => {},
      setPendingFollowUp,
      createSession: {
        mutate: () => {
          throw new Error("createSession should not be called");
        },
      },
      followUp: {
        mutate: (input, options) => {
          followUpInputs.push(input);
          options.onSuccess();
        },
      },
      reconnect: () => {},
    });

    expect(followUpInputs).toEqual([
      {
        sessionId: "session-1",
        prompt: "What's the weather like?: Nice",
        agent: "opencode",
        model: undefined,
        questionResponse: { answers: [["Nice"]] },
        attachments: [],
      },
    ]);
    expect(pendingUpdates).toEqual([null]);
  });

  test("passes attachments to follow-up and keeps optimistic pending state", () => {
    const followUpInputs: Array<Parameters<FollowUpMutation["mutate"]>[0]> = [];
    let pendingFollowUp: PendingFollowUpState | null = null;
    const setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>> = (value) => {
      pendingFollowUp = typeof value === "function" ? value(pendingFollowUp) : value;
    };

    const attachments = [
      {
        id: "file_1",
        file_name: "screen.png",
        mime_type: "image/png",
        size_bytes: 123,
      },
    ];

    submitSessionMessage({
      sessionId: "session-1",
      projectId: "project-1",
      agent: "claude-code",
      model: undefined,
      text: "Check this",
      attachments,
      messages: [],
      pendingIdRef: { current: 0 },
      clearSessionDraft: () => {},
      setChatDraft: () => {},
      setPendingFollowUp,
      createSession: {
        mutate: () => {
          throw new Error("createSession should not be called");
        },
      },
      followUp: {
        mutate: (input) => {
          followUpInputs.push(input);
        },
      },
      reconnect: () => {},
    });

    expect(followUpInputs[0]?.attachments).toEqual(attachments);
    expect(pendingFollowUp).not.toBeNull();
  });
});
