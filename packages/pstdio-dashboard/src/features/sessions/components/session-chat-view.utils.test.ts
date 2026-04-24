import { describe, expect, it } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createPendingFollowUpState } from "./session-chat-state";
import {
  countCompletedEditActions,
  getActiveQuestionPrompt,
  isSessionInterruptible,
  resolveNewSessionWorkspaceId,
  shouldReconnectForExternalResume,
  shouldResetPendingFollowUpForSession,
} from "./session-chat-view.utils";

const message = (id: string, parts: SessionMessage["parts"]): SessionMessage => ({
  id,
  role: "assistant",
  parts,
});

describe("countCompletedEditActions", () => {
  it("counts only completed write and execute tool actions", () => {
    const messages = [
      message("m1", [
        { type: "tool", tool: "read-file", actionType: "read", status: "completed" },
        { type: "tool", tool: "write-file", actionType: "write", status: "completed" },
      ]),
      message("m2", [
        { type: "tool", tool: "run-tests", actionType: "execute", status: "completed" },
        { type: "tool", tool: "apply-patch", actionType: "write", status: "running" },
      ]),
    ];

    expect(countCompletedEditActions(messages)).toBe(2);
  });
});

describe("shouldReconnectForExternalResume", () => {
  it("returns true when transitioning from failed to in_progress while not streaming", () => {
    expect(shouldReconnectForExternalResume("failed", "in_progress", false)).toBe(true);
  });

  it("returns true when transitioning from completed to in_progress while not streaming", () => {
    expect(shouldReconnectForExternalResume("completed", "in_progress", false)).toBe(true);
  });

  it("returns true when transitioning from cancelled to in_progress while not streaming", () => {
    expect(shouldReconnectForExternalResume("cancelled", "in_progress", false)).toBe(true);
  });

  it("returns false on initial mount", () => {
    expect(shouldReconnectForExternalResume(null, "in_progress", false)).toBe(false);
  });

  it("returns false when already streaming", () => {
    expect(shouldReconnectForExternalResume("failed", "in_progress", true)).toBe(false);
  });

  it("returns false when transitioning to a non-in_progress status", () => {
    expect(shouldReconnectForExternalResume("in_progress", "failed", false)).toBe(false);
  });

  it("returns false when staying in the same terminal status", () => {
    expect(shouldReconnectForExternalResume("failed", "failed", false)).toBe(false);
  });
});

describe("isSessionInterruptible", () => {
  it("returns true for active session statuses", () => {
    expect(isSessionInterruptible("in_progress")).toBe(true);
    expect(isSessionInterruptible("awaiting_input")).toBe(true);
  });

  it("returns false for terminal and missing statuses", () => {
    expect(isSessionInterruptible("completed")).toBe(false);
    expect(isSessionInterruptible("failed")).toBe(false);
    expect(isSessionInterruptible("cancelled")).toBe(false);
    expect(isSessionInterruptible("disconnected")).toBe(false);
    expect(isSessionInterruptible(null)).toBe(false);
  });
});

it("resets pending follow up when it belongs to another session", () => {
  const pending = createPendingFollowUpState({
    prompt: "Continue the fix",
    messageCount: 1,
    pendingId: "pending-1",
    sessionId: "session-1",
  });

  expect(shouldResetPendingFollowUpForSession(pending, "session-1")).toBe(false);
  expect(shouldResetPendingFollowUpForSession(pending, "session-2")).toBe(true);
  expect(shouldResetPendingFollowUpForSession(pending, null)).toBe(true);
  expect(shouldResetPendingFollowUpForSession(null, "session-2")).toBe(false);
});

describe("resolveNewSessionWorkspaceId", () => {
  it("returns the current workspace id for a new workspace-scoped draft", () => {
    expect(
      resolveNewSessionWorkspaceId({
        sessionId: null,
        workspaceId: undefined,
        newSessionWorkspaceId: "workspace-1",
      }),
    ).toBe("workspace-1");
  });

  it("prefers the explicit workspace id for existing sessions", () => {
    expect(
      resolveNewSessionWorkspaceId({
        sessionId: "session-1",
        workspaceId: "workspace-2",
        newSessionWorkspaceId: "workspace-1",
      }),
    ).toBe("workspace-2");
  });

  it("returns undefined for generic new sessions", () => {
    expect(
      resolveNewSessionWorkspaceId({
        sessionId: null,
        workspaceId: undefined,
        newSessionWorkspaceId: undefined,
      }),
    ).toBeUndefined();
  });

  it("does not reuse a pending workspace when caller does not provide workspace context", () => {
    expect(
      resolveNewSessionWorkspaceId({
        sessionId: null,
        workspaceId: undefined,
        newSessionWorkspaceId: undefined,
      }),
    ).toBeUndefined();
  });
});

describe("getActiveQuestionPrompt", () => {
  it("returns parsed question payload from the latest question tool part", () => {
    const messages: SessionMessage[] = [
      message("assistant-1", [
        {
          type: "tool",
          tool: "question",
          state: {
            input: {
              tool: "question",
              questions: [
                {
                  id: "language",
                  type: "single_choice",
                  question: "Which language do you want to use?",
                  options: ["TypeScript", "Go", "Rust"],
                  required: true,
                },
              ],
            },
          },
        },
      ]),
    ];

    expect(getActiveQuestionPrompt(messages)).toEqual({
      questions: [
        {
          id: "language",
          question: "Which language do you want to use?",
          options: [
            { label: "TypeScript", description: undefined },
            { label: "Go", description: undefined },
            { label: "Rust", description: undefined },
          ],
          multiple: false,
          required: true,
          allowCustomAnswer: false,
        },
      ],
    });
  });

  it("returns parsed question payload when tool input is JSON text", () => {
    const messages: SessionMessage[] = [
      message("assistant-1", [
        {
          type: "tool",
          tool: "Question",
          state: {
            input: JSON.stringify({
              questions: [
                {
                  header: "Weather",
                  options: [
                    { description: "Sunny and warm", label: "Sunny" },
                    { description: "Rainy or wet conditions", label: "Rainy" },
                  ],
                  question: "What's the weather like where you are today?",
                },
              ],
            }),
          },
        },
      ]),
    ];

    expect(getActiveQuestionPrompt(messages)).toEqual({
      questions: [
        {
          id: "question-0",
          question: "What's the weather like where you are today?",
          options: [
            { label: "Sunny", description: "Sunny and warm" },
            { label: "Rainy", description: "Rainy or wet conditions" },
          ],
          multiple: false,
          required: false,
          allowCustomAnswer: false,
        },
      ],
    });
  });

  it("returns undefined once a later user message exists", () => {
    const messages: SessionMessage[] = [
      message("assistant-1", [
        {
          type: "tool",
          tool: "question",
          state: {
            input: {
              questions: [
                {
                  question: "Pick one",
                  options: [{ label: "One", description: "" }],
                  multiple: false,
                },
              ],
            },
          },
        },
      ]),
      {
        id: "user-2",
        role: "user",
        parts: [{ type: "text", text: "One" }],
      },
    ];

    expect(getActiveQuestionPrompt(messages)).toBeUndefined();
  });

  it("supports multi-choice and custom-answer payloads", () => {
    const messages: SessionMessage[] = [
      message("assistant-1", [
        {
          type: "tool",
          tool: "question",
          state: {
            input: {
              questions: [
                {
                  id: "framework",
                  question: "Choose frameworks",
                  options: [
                    { label: "React", description: "UI" },
                    { label: "Vue", description: "UI" },
                  ],
                  multiple: true,
                  custom: true,
                },
              ],
            },
          },
        },
      ]),
    ];

    expect(getActiveQuestionPrompt(messages)).toEqual({
      questions: [
        {
          id: "framework",
          question: "Choose frameworks",
          options: [
            { label: "React", description: "UI" },
            { label: "Vue", description: "UI" },
          ],
          multiple: true,
          required: false,
          allowCustomAnswer: true,
        },
      ],
    });
  });

  it("falls back to the latest usable question payload when a newer one is malformed", () => {
    const messages: SessionMessage[] = [
      message("assistant-1", [
        {
          type: "tool",
          tool: "question",
          state: {
            input: {
              questions: [
                {
                  id: "valid",
                  question: "Choose one",
                  options: [{ label: "A" }, { label: "B" }],
                  multiple: false,
                },
              ],
            },
          },
        },
      ]),
      message("assistant-2", [
        {
          type: "tool",
          tool: "question",
          state: {
            input: {
              questions: [
                {
                  id: "broken",
                  question: "Broken question",
                  options: [],
                  multiple: false,
                },
              ],
            },
          },
        },
      ]),
    ];

    expect(getActiveQuestionPrompt(messages)).toEqual({
      questions: [
        {
          id: "valid",
          question: "Choose one",
          options: [
            { label: "A", description: undefined },
            { label: "B", description: undefined },
          ],
          multiple: false,
          required: false,
          allowCustomAnswer: false,
        },
      ],
    });
  });
});
