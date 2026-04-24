import { describe, expect, it } from "bun:test";
import { createEventStore } from "../../services/event-store";
import type { JsonPatch, SessionMessage } from "../../types";
import { pollOpencodeQuestionReply } from "./opencode-question-reply-poller";
import { pollOpencodeMessages, pollOpencodeUntilIdle } from "./opencode-session-poller";
import {
  collectPatches,
  completedAssistant,
  createMessageTimeline,
  inFlightAssistant,
  questionAssistant,
  tick,
  userMessage,
} from "./opencode-session-poller.test-helpers";

const lastStatusPatch = (eventStore: ReturnType<typeof createEventStore>) =>
  eventStore
    .getHistory()
    .filter((patch: JsonPatch) => patch.path === "/status")
    .at(-1);

const errorInfo = {
  name: "service_unavailable_error",
  data: { message: "Our servers are currently overloaded." },
};

describe("pollOpencodeMessages", () => {
  it("marks session as failed when current turn has an error", async () => {
    const eventStore = createEventStore();

    const result = await pollOpencodeMessages({
      loadMessages: async () => [userMessage("hello"), completedAssistant("partial", errorInfo)],
      sessionId: "test-session",
      cwd: "/tmp",
      eventStore,
      baselineCount: 1,
      messageComplete: Promise.resolve(),
    });

    expect(lastStatusPatch(eventStore)?.value).toBe("failed");
    expect(result.code).toBe(1);
    eventStore.close();
  });

  it("historical error does not poison a successful follow-up turn", async () => {
    const oldError = completedAssistant("old fail", errorInfo);
    const followUpUser = userMessage("retry");
    const successReply = completedAssistant("success");
    const eventStore = createEventStore();

    const result = await pollOpencodeMessages({
      loadMessages: async () => [userMessage("hello"), oldError, followUpUser, successReply],
      sessionId: "test-session",
      cwd: "/tmp",
      eventStore,
      baselineCount: 3,
      messageComplete: Promise.resolve(),
    });

    expect(lastStatusPatch(eventStore)?.value).toBe("completed");
    expect(result.code).toBe(0);
    eventStore.close();
  });

  it("completes when the assistant turn finishes with a completed timestamp", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();
    set([userMessage("hello")]);

    let resolvePost: () => void;
    const messageComplete = new Promise<void>((resolve) => {
      resolvePost = resolve;
    });

    const poll = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      baselineCount: 1,
      messageComplete,
    });

    await tick();
    set([userMessage("hello"), inFlightAssistant("thinking...")]);
    await tick();
    set([userMessage("hello"), completedAssistant("done!")]);
    resolvePost!();
    await tick();

    expect((await poll).code).toBe(0);
    expect(lastStatusPatch(eventStore)?.value).toBe("completed");
    eventStore.close();
  });

  it("completes when the assistant asks a question without a completed timestamp", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();
    set([userMessage("implement feature X")]);

    let resolvePost: () => void;
    const messageComplete = new Promise<void>((resolve) => {
      resolvePost = resolve;
    });

    const poll = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      baselineCount: 1,
      messageComplete,
    });

    await tick();
    set([userMessage("implement feature X"), questionAssistant()]);
    resolvePost!();
    await tick();

    expect((await poll).code).toBe(0);
    expect(lastStatusPatch(eventStore)?.value).toBe("completed");
    eventStore.close();
  });

  it("waits for an assistant response when only the user answer is visible", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();
    const { patches } = collectPatches(eventStore);
    const baseline = [userMessage("implement feature X"), questionAssistant()];
    set(baseline);

    let resolvePost: () => void;
    const messageComplete = new Promise<void>((resolve) => {
      resolvePost = resolve;
    });

    const poll = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      baselineCount: 2,
      messageComplete,
    });

    await tick();
    set([...baseline, userMessage("TypeScript")]);
    await tick();
    await tick();

    expect(patches.filter((patch) => patch.path === "/status")).toHaveLength(0);

    set([...baseline, userMessage("TypeScript"), completedAssistant("Great, using TypeScript!")]);
    resolvePost!();
    await tick();

    const result = await poll;
    const messagePatches = eventStore.getHistory().filter((patch) => patch.path === "/messages");
    const finalMessages = messagePatches.at(-1)?.value as SessionMessage[];

    expect(finalMessages.at(-1)).toMatchObject({ parts: [{ type: "text", text: "Great, using TypeScript!" }] });
    expect(lastStatusPatch(eventStore)?.value).toBe("completed");
    expect(result.code).toBe(0);
    eventStore.close();
  });

  it("stops when POST fails and no new messages appeared", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();
    set([userMessage("hello")]);

    const messageComplete = Promise.reject(new Error("network error"));
    messageComplete.catch(() => {});

    const poll = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      baselineCount: 1,
      messageComplete,
    });

    await tick();

    expect((await poll).code).toBe(1);
    expect(lastStatusPatch(eventStore)?.value).toBe("failed");
    eventStore.close();
  });

  it("stops when POST succeeds with no visible activity and nothing in flight", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();
    set([userMessage("hello")]);

    const poll = pollOpencodeMessages({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      baselineCount: 1,
      messageComplete: Promise.resolve(),
    });

    await tick();
    await tick();

    expect((await poll).code).toBe(0);
    eventStore.close();
  });
});

describe("pollOpencodeQuestionReply", () => {
  it("waits for the assistant continuation after the question answer is accepted", async () => {
    const { loader, set } = createMessageTimeline();
    const eventStore = createEventStore();
    const user = userMessage("ask me");
    const questionMessage = {
      info: { id: "msg-question", role: "assistant", time: { created: Date.now() } },
      parts: [
        {
          type: "tool",
          tool: "question",
          callID: "call-question",
          state: {
            status: "running",
            input: { questions: [{ question: "Weather?", options: [{ label: "Nice" }] }] },
          },
        },
      ],
    };
    const answeredQuestionMessage = {
      info: { id: "msg-question", role: "assistant", time: { created: Date.now(), completed: Date.now() } },
      parts: [
        {
          type: "tool",
          tool: "question",
          callID: "call-question",
          state: {
            status: "completed",
            input: { questions: [{ question: "Weather?", options: [{ label: "Nice" }] }] },
            output: "User has answered your questions.",
            metadata: { answers: [["Nice"]] },
          },
        },
      ],
    };
    const continuationStarted = {
      info: { id: "msg-continuation", role: "assistant", time: { created: Date.now() } },
      parts: [{ type: "step-start", snapshot: "abc" }],
    };
    const continuationCompleted = {
      info: { id: "msg-continuation", role: "assistant", time: { created: Date.now(), completed: Date.now() } },
      parts: [
        { type: "step-start", snapshot: "abc" },
        { type: "text", text: "Got it - Nice." },
        { type: "step-finish", snapshot: "abc" },
      ],
    };

    set([user, questionMessage]);

    let resolvePost: () => void;
    const messageComplete = new Promise<void>((resolve) => {
      resolvePost = resolve;
    });
    const poll = pollOpencodeQuestionReply({
      loadMessages: loader,
      sessionId: "s1",
      cwd: undefined,
      eventStore,
      questionTool: { messageID: "msg-question", callID: "call-question" },
      messageComplete,
    });

    await Bun.sleep(50);
    set([user, answeredQuestionMessage]);
    resolvePost!();
    await Bun.sleep(50);
    set([user, answeredQuestionMessage, continuationStarted]);
    await tick();

    expect(lastStatusPatch(eventStore)).toBeUndefined();

    set([user, answeredQuestionMessage, continuationCompleted]);
    await tick();
    await tick();

    const result = await poll;
    const messagePatches = eventStore.getHistory().filter((patch) => patch.path === "/messages");
    const finalMessages = messagePatches.at(-1)?.value as SessionMessage[];

    expect(result.code).toBe(0);
    expect(finalMessages.at(-1)?.parts).toContainEqual({ type: "text", text: "Got it - Nice." });
    expect(lastStatusPatch(eventStore)?.value).toBe("completed");
    eventStore.close();
  });
});

describe("pollOpencodeUntilIdle", () => {
  it("marks session as failed when trailing message has an error", async () => {
    const eventStore = createEventStore();

    const result = await pollOpencodeUntilIdle({
      loadMessages: async () => [userMessage("hello"), completedAssistant("partial", errorInfo)],
      sessionId: "test-session",
      cwd: "/tmp",
      eventStore,
    });

    expect(lastStatusPatch(eventStore)?.value).toBe("failed");
    expect(result.code).toBe(1);
    eventStore.close();
  });

  it("historical error does not poison reattach when trailing turn succeeds", async () => {
    const eventStore = createEventStore();

    const result = await pollOpencodeUntilIdle({
      loadMessages: async () => [
        userMessage("hello"),
        completedAssistant("old fail", errorInfo),
        userMessage("retry"),
        completedAssistant("all good"),
      ],
      sessionId: "test-session",
      cwd: "/tmp",
      eventStore,
    });

    expect(lastStatusPatch(eventStore)?.value).toBe("completed");
    expect(result.code).toBe(0);
    eventStore.close();
  });
});
