import { describe, expect, it } from "bun:test";
import { createSessionFromPrompt, openSessionBubbleAndGoBack } from "./sessions-panel-actions";

describe("createSessionFromPrompt", () => {
  it("creates a session and opens it when project and agent are available", () => {
    const createSessionCalls: Array<{ projectId: string; prompt: string; agent: string; model?: string }> = [];
    const openedSessionCalls: string[] = [];

    createSessionFromPrompt({
      projectId: "project-1",
      prompt: "Write a changelog entry",
      agent: "codex",
      model: "gpt-5.4",
      createSession: (input, options) => {
        createSessionCalls.push(input);
        options?.onSuccess?.({ sessionId: "session-42" });
      },
      openSession: (sessionId) => {
        openedSessionCalls.push(sessionId);
      },
    });

    expect(createSessionCalls).toEqual([
      {
        projectId: "project-1",
        prompt: "Write a changelog entry",
        agent: "codex",
        model: "gpt-5.4",
      },
    ]);
    expect(openedSessionCalls).toEqual(["session-42"]);
  });

  it("does nothing without a project id", () => {
    let createCalls = 0;
    let openCalls = 0;

    createSessionFromPrompt({
      projectId: undefined,
      prompt: "hello",
      agent: "codex",
      createSession: () => {
        createCalls += 1;
      },
      openSession: () => {
        openCalls += 1;
      },
    });

    expect(createCalls).toBe(0);
    expect(openCalls).toBe(0);
  });

  it("does nothing without an agent", () => {
    let createCalls = 0;
    let openCalls = 0;

    createSessionFromPrompt({
      projectId: "project-1",
      prompt: "hello",
      agent: undefined,
      createSession: () => {
        createCalls += 1;
      },
      openSession: () => {
        openCalls += 1;
      },
    });

    expect(createCalls).toBe(0);
    expect(openCalls).toBe(0);
  });
});

describe("openSessionBubbleAndGoBack", () => {
  it("opens the bubble with the selected session and navigates back", () => {
    const events: string[] = [];

    openSessionBubbleAndGoBack({
      sessionId: "session-24",
      setSessionModalState: (state) => {
        events.push(`state:${state}`);
      },
      setSelectedSessionId: (sessionId) => {
        events.push(`session:${sessionId}`);
      },
      navigateBack: () => {
        events.push("navigate");
      },
    });

    expect(events).toEqual(["state:bubble", "session:session-24", "navigate"]);
  });
});
