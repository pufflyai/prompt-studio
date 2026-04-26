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
      },
    ]);
    expect(pendingUpdates).toEqual([null]);
  });

  test("restores question prompt suppression when a question response follow-up fails", () => {
    let restoredQuestionPrompt = false;

    submitSessionMessage({
      sessionId: "session-1",
      projectId: "project-1",
      agent: "opencode",
      model: undefined,
      text: "What's the weather like?: Nice",
      questionResponse: { answers: [["Nice"]] },
      messages: [],
      pendingIdRef: { current: 0 },
      clearSessionDraft: () => {},
      setChatDraft: () => {},
      setPendingFollowUp: () => {},
      createSession: {
        mutate: () => {
          throw new Error("createSession should not be called");
        },
      },
      followUp: {
        mutate: (_input, options) => {
          options.onError();
        },
      },
      reconnect: () => {},
      onQuestionResponseError: () => {
        restoredQuestionPrompt = true;
      },
    });

    expect(restoredQuestionPrompt).toBe(true);
  });
});
