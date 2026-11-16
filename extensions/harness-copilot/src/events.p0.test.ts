import { expect, test } from "bun:test";
import type { SessionEvent } from "@github/copilot-sdk";
import type { SessionMessagePart } from "@pstdio/sdk/extensions";
import { event } from "./copilot.fixture";
import { forkBoundary, normalizeCopilotEvents } from "./events";
import recorded from "./fixtures/live-turn.json";

test("a streamed turn becomes one user message and one assistant message with reasoning, tools and usage", () => {
  const log = [
    event("user.message", { content: "List files", transformedContent: "<datetime/> List files" }),
    event("assistant.reasoning_delta", { reasoningId: "r1", deltaContent: "Need " }, true),
    event("assistant.reasoning_delta", { reasoningId: "r1", deltaContent: "ls." }, true),
    event("assistant.message_delta", { messageId: "m1", deltaContent: "Run" }, true),
    event("assistant.message_delta", { messageId: "m1", deltaContent: "ning ls" }, true),
  ];
  const streaming = normalizeCopilotEvents(log);
  expect(streaming.map((message) => message.parts)).toEqual([
    [{ type: "text", text: "List files" }],
    [
      { type: "reasoning", text: "Need ls." },
      { type: "text", text: "Running ls" },
    ],
  ]);

  log.push(
    event("assistant.reasoning", { reasoningId: "r1", content: "Need ls." }),
    // Copilot reports a call's usage just before the message that call produced.
    event("assistant.usage", { model: "gpt-6-luna", inputTokens: 10, outputTokens: 4, cacheReadTokens: 2 }, true),
    event("assistant.message", {
      messageId: "m1",
      content: "Running ls",
      model: "gpt-6-luna",
      toolRequests: [{ toolCallId: "t1", name: "bash", arguments: { command: "ls" } }],
    }),
    event("tool.execution_start", { toolCallId: "t1", toolName: "bash", arguments: { command: "ls" } }),
    event("subagent.message", { parentToolCallId: "t1", content: "ignored" }),
    event("tool.execution_complete", { toolCallId: "t1", success: true, result: { content: "note.txt" } }),
    event("session.idle", {}, true),
  );
  const settled = normalizeCopilotEvents(log, 3);
  expect(settled.map((message) => message.id)).toEqual(streaming.map((message) => message.id));
  expect(settled[0]?.index).toBe(3);
  expect(settled[1]).toMatchObject({ role: "assistant", modelId: "gpt-6-luna" });
  expect(settled[1]?.parts).toEqual([
    { type: "reasoning", text: "Need ls." },
    { type: "text", text: "Running ls" },
    {
      type: "tool",
      tool: "bash",
      callId: "t1",
      status: "completed",
      state: { input: { command: "ls" }, output: "note.txt" },
    },
    { type: "token_usage", inputTokens: 10, outputTokens: 4, cacheReadTokens: 2, cacheWriteTokens: undefined },
  ]);
});

test("a quota error and an interrupted tool stay visible after the turn ends", () => {
  const messages = normalizeCopilotEvents([
    event("user.message", { content: "Fix it" }),
    event("assistant.message", { messageId: "m1", content: "", toolRequests: [{ toolCallId: "t1", name: "edit" }] }),
    event("permission.completed", {
      requestId: "p1",
      toolCallId: "t1",
      result: { kind: "denied-interactively-by-user" },
    }),
    event("session.error", { errorType: "quota", message: "You have exceeded your monthly quota" }),
    event("session.idle", {}, true),
  ]);
  expect(messages[1]?.parts).toEqual([
    { type: "tool", tool: "edit", callId: "t1", status: "denied", state: { input: undefined } },
    { type: "error", errorType: "other", message: "You have exceeded your monthly quota" },
  ]);

  const interrupted = normalizeCopilotEvents([
    event("user.message", { content: "Run" }),
    event("tool.execution_start", { toolCallId: "t2", toolName: "bash" }),
    event("abort", { reason: "user" }),
  ]);
  expect(interrupted[1]?.parts[0]).toMatchObject({ callId: "t2", status: "failed" });
});

const describe = (part: SessionMessagePart) => {
  if (part.type === "tool") return `${part.tool}:${part.status}`;
  return part.type === "text" ? part.text : part.type;
};

test("a recorded Copilot turn with two tool calls and a permission prompt normalizes to one message per model call", () => {
  const messages = normalizeCopilotEvents(recorded as unknown as SessionEvent[]);
  expect(messages.map((message) => [message.role, message.parts.map(describe)])).toEqual([
    ["user", ["Run `ls` in the shell, then read note.txt, then reply with one short sentence."]],
    ["assistant", ["bash:completed", "token_usage"]],
    ["assistant", ["view:completed", "token_usage"]],
    ["assistant", ["`ls` showed `note.txt`, which contains “hello from fixture.”", "token_usage"]],
  ]);
  expect(messages[2]?.parts[0]).toMatchObject({
    state: { input: { path: "/tmp/copilot-run/note.txt" }, output: "hello from fixture\n" },
  });
});

test("a fork through a message keeps that model call's tool results and stops at the next call", () => {
  const log = recorded as unknown as SessionEvent[];
  const [prompt, bash, view, reply] = normalizeCopilotEvents(log);
  // The bash call's result arrives before the second model call starts, so the fork keeps it.
  expect(forkBoundary(log, bash!.id)).toBe(log[6]?.id);
  expect(forkBoundary(log, view!.id)).toBe(log[12]?.id);
  expect(forkBoundary(log, prompt!.id)).toBe(log[1]?.id);
  expect(forkBoundary(log, reply!.id)).toBeUndefined();
  expect(() => forkBoundary(log, "elsewhere")).toThrow("not in this Copilot session");
});

test("steered input keeps the host delivery id as its message id", () => {
  const [, steered] = normalizeCopilotEvents([
    event("user.message", { content: "first" }),
    event("user.message", { content: "also this", clientTurnId: "delivery-1" }),
  ]);
  expect(steered).toMatchObject({ id: "delivery-1", role: "user", parts: [{ type: "text", text: "also this" }] });
});

test("a turn cut off by a host restart shows its tool call as failed", () => {
  // Copilot's runtime exits with the host and records this sequence before it stops.
  const messages = normalizeCopilotEvents([
    event("user.message", { content: "Run a long command" }),
    event("assistant.message", { messageId: "m1", content: "", toolRequests: [{ toolCallId: "t1", name: "bash" }] }),
    event("tool.execution_start", { toolCallId: "t1", toolName: "bash" }),
    event("assistant.turn_end", { turnId: "0" }),
    event("session.shutdown", { shutdownType: "routine", modelMetrics: {} }),
  ]);
  expect(messages[1]?.parts[0]).toMatchObject({ callId: "t1", status: "failed" });
});

test("subagent work and hidden skill prompts stay out of the conversation", () => {
  const agent = { agentId: "task-1" };
  const messages = normalizeCopilotEvents([
    event("user.message", { content: "Investigate" }),
    event("assistant.message", {
      messageId: "m1",
      content: "Delegating",
      toolRequests: [{ toolCallId: "t1", name: "task" }],
    }),
    event("tool.execution_start", { toolCallId: "t1", toolName: "task" }),
    event("user.message", { content: "Subagent prompt" }, false, agent),
    event("assistant.reasoning", { reasoningId: "r-sub", content: "subagent thinking" }, false, agent),
    event("assistant.message", { messageId: "m-sub", content: "subagent reply" }, false, agent),
    event("session.error", { errorType: "tool", message: "subagent failed" }, false, agent),
    event("user.message", { content: "<skill text>", source: "skill-pdf" }),
    event("tool.execution_complete", { toolCallId: "t1", success: true, result: { content: "found it" } }),
    event("assistant.message", { messageId: "m2", content: "Done" }),
  ]);
  expect(messages.map((message) => [message.role, message.parts.map((part) => part.type)])).toEqual([
    ["user", ["text"]],
    ["assistant", ["text", "tool"]],
    ["assistant", ["text"]],
  ]);
  expect(messages[1]?.parts[1]).toMatchObject({ status: "completed", state: { output: "found it" } });
});

test("a fork through a message that ran a subagent keeps the subagent's result", () => {
  const agent = { agentId: "task-1" };
  const log = [
    event("user.message", { content: "Investigate" }),
    event("assistant.turn_start", { turnId: "0" }),
    event("assistant.message", { messageId: "m1", content: "", toolRequests: [{ toolCallId: "t1", name: "task" }] }),
    event("tool.execution_start", { toolCallId: "t1", toolName: "task" }),
    event("assistant.turn_start", { turnId: "0" }, false, agent),
    event("user.message", { content: "Subagent prompt" }, false, agent),
    event("tool.execution_complete", { toolCallId: "t1", success: true, result: { content: "found it" } }),
    event("assistant.turn_start", { turnId: "1" }),
  ];
  const [, delegated] = normalizeCopilotEvents(log);
  expect(forkBoundary(log, delegated!.id)).toBe(log[7]?.id);
});

test("a turn that ended without settling marks its running tools as failed", () => {
  const log = [
    event("user.message", { content: "Run" }),
    event("tool.execution_start", { toolCallId: "t1", toolName: "bash" }),
  ];
  expect(normalizeCopilotEvents(log)[1]?.parts[0]).toMatchObject({ status: "running" });
  expect(normalizeCopilotEvents(log, 0, true)[1]?.parts[0]).toMatchObject({ status: "failed" });
});

test("saved history, which keeps no streaming events, has the same messages as the live turn", () => {
  const live = recorded as unknown as SessionEvent[];
  const saved = live.filter((event) => !event.ephemeral);
  const strip = (messages: ReturnType<typeof normalizeCopilotEvents>) =>
    messages.map((message) => ({ ...message, parts: message.parts.filter((part) => part.type !== "token_usage") }));
  expect(strip(normalizeCopilotEvents(saved))).toEqual(strip(normalizeCopilotEvents(live)));
});

test("Copilot's ask_user call becomes the question tool the chat's question form reads", () => {
  const [, asked] = normalizeCopilotEvents([
    event("user.message", { content: "Pick" }),
    event("assistant.message", {
      messageId: "m1",
      content: "",
      toolRequests: [
        { toolCallId: "ask-1", name: "ask_user", arguments: { question: "Which color?", choices: ["Red", "Blue"] } },
      ],
    }),
  ]);
  expect(asked?.parts[0]).toEqual({
    type: "tool",
    tool: "question",
    callId: "ask-1",
    status: "running",
    state: {
      input: {
        questions: [{ question: "Which color?", options: [{ label: "Red" }, { label: "Blue" }], custom: true }],
      },
    },
  });
});

test("reasoning shows while it streams, joins its reply, and survives an interrupted turn", () => {
  const thinking = [
    event("user.message", { content: "Think" }),
    event("assistant.reasoning_delta", { reasoningId: "r1", deltaContent: "Considering" }, true),
  ];
  const streaming = normalizeCopilotEvents(thinking);
  expect(streaming[1]?.parts).toEqual([{ type: "reasoning", text: "Considering" }]);

  const answered = normalizeCopilotEvents([
    ...thinking,
    event("assistant.message", { messageId: "m1", content: "Done" }),
  ]);
  expect(answered).toHaveLength(2);
  expect(answered[1]).toMatchObject({
    id: "copilot-m1",
    parts: [
      { type: "reasoning", text: "Considering" },
      { type: "text", text: "Done" },
    ],
  });

  const interrupted = normalizeCopilotEvents([
    ...thinking,
    event("abort", { reason: "user" }),
    event("user.message", { content: "Next" }),
    event("assistant.message", { messageId: "m2", content: "Fresh" }),
  ]);
  expect(interrupted.map((message) => message.parts.map((part) => part.type))).toEqual([
    ["text"],
    ["reasoning"],
    ["text"],
    ["text"],
  ]);
});

test("a tool interrupted in an earlier turn stays failed while a later turn runs", () => {
  const messages = normalizeCopilotEvents([
    event("user.message", { content: "Run" }),
    event("tool.execution_start", { toolCallId: "t1", toolName: "bash" }),
    event("abort", { reason: "user" }),
    event("user.message", { content: "Again" }),
    event("assistant.message_delta", { messageId: "m2", deltaContent: "Working" }, true),
  ]);
  expect(messages[1]?.parts[0]).toMatchObject({ callId: "t1", status: "failed" });
});
