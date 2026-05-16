import { describe, expect, test } from "bun:test";
import type { Dispatch, SetStateAction } from "react";
import type { PendingFollowUpState } from "./session-chat-state";
import { type CreateSessionMutation, type FollowUpMutation, submitSessionMessage } from "./session-chat-view-actions";

describe("submitSessionMessage", () => {
  test("passes the selected agent and model to new session creation", () => {
    const createInputs: Array<Parameters<CreateSessionMutation["mutate"]>[0]> = [];

    submitSessionMessage({
      sessionId: null,
      projectId: "project-1",
      agent: "opencode",
      model: "openai/gpt-5.5",
      text: "Start from the dashboard",
      messages: [],
      pendingIdRef: { current: 0 },
      clearSessionDraft: () => {},
      setChatDraft: () => {},
      setPendingFollowUp: () => {},
      createSession: {
        mutate: (input, options) => {
          createInputs.push(input);
          options.onSuccess({ sessionId: "session-1", status: "in_progress" });
        },
      },
      followUp: {
        mutate: () => {
          throw new Error("followUp should not be called");
        },
      },
      reconnect: () => {},
    });

    expect(createInputs).toEqual([
      {
        projectId: "project-1",
        prompt: "Start from the dashboard",
        agent: "opencode",
        model: "openai/gpt-5.5",
        workspaceId: undefined,
      },
    ]);
  });

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
          options.onSuccess({ status: "in_progress" });
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

  test("clears optimistic loading when a new session is queued", () => {
    let pendingFollowUp: PendingFollowUpState | null = null;
    const pendingUpdates: Array<PendingFollowUpState | null> = [];
    const setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>> = (value) => {
      pendingFollowUp = typeof value === "function" ? value(pendingFollowUp) : value;
      pendingUpdates.push(pendingFollowUp);
    };

    submitSessionMessage({
      sessionId: null,
      projectId: "project-1",
      agent: "opencode",
      model: undefined,
      text: "Start queued work",
      messages: [],
      pendingIdRef: { current: 0 },
      clearSessionDraft: () => {},
      setChatDraft: () => {},
      setPendingFollowUp,
      createSession: {
        mutate: (_input, options) => {
          options.onSuccess({ sessionId: "session-queued", status: "queued" });
        },
      },
      followUp: {
        mutate: () => {
          throw new Error("followUp should not be called");
        },
      },
      reconnect: () => {},
    });

    expect(pendingUpdates.map((entry) => entry?.userMessageId ?? null)).toEqual(["pending-0-user", null]);
  });

  test("keeps optimistic loading and reconnects when a follow-up is queued", () => {
    let pendingFollowUp: PendingFollowUpState | null = null;
    let reconnectCount = 0;
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
      text: "Queue this follow-up",
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
        mutate: (_input, options) => {
          options.onSuccess({ status: "queued" });
        },
      },
      reconnect: () => {
        reconnectCount += 1;
      },
    });

    expect(pendingUpdates.map((entry) => entry?.userMessageId ?? null)).toEqual(["pending-0-user"]);
    expect(pendingFollowUp).toMatchObject({ prompt: "Queue this follow-up", sessionId: "session-1" });
    expect(reconnectCount).toBe(1);
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
