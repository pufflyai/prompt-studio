import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { observedSessionChange, renderedObservation } from "./changes";

test("completion metadata cannot acknowledge a still-streaming fragment with the final message ID", async () => {
  const session = {
    createdAt: "created",
    status: "completed",
    changePositions: {
      reply: {
        id: "same",
        position: 8,
        textDigest: "a7d57fcddf4188887b3e1f38d435a2b80bff527a73269a4359c53a6dcedf52f7",
      },
    },
  };
  const transcript = (text: string) => [
    { id: "same", role: "assistant" as const, parts: [{ type: "text" as const, text }] },
  ];
  expect(await observedSessionChange(session, transcript("answer"))).toBeNull();
  expect(await observedSessionChange(session, transcript("answer is 41"))).toBeNull();
  expect(await observedSessionChange(session, transcript("answer is 42"))).toEqual({
    lineage: "conversation-v1/created",
    revision: "8",
  });
});

test("reply-only receipts name the actual content rather than an absent approval", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { resources: { observeChange: async () => "receipt" } },
  });
  const session = {
    createdAt: "created",
    status: "completed",
    changePositions: {
      reply: {
        id: "reply",
        position: 1,
        textDigest: "a7d57fcddf4188887b3e1f38d435a2b80bff527a73269a4359c53a6dcedf52f7",
      },
    },
  };
  const observation = await renderedObservation(ctx, "s", session, [
    { id: "reply", role: "assistant", parts: [{ type: "text", text: "answer is 42" }] },
  ]);
  expect(observation).toMatchObject({
    observedChange: "receipt",
    observedChangeMessageIds: ["reply"],
    observedChangeQuestionId: null,
  });
});

test("question receipts identify their exact request and containing transcript row", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { resources: { observeChange: async () => "receipt" } },
  });
  const session = {
    createdAt: "created",
    status: "awaiting_input",
    changePositions: { input: { id: "new-question", position: 2 } },
  };
  const pending = {
    type: "tool" as const,
    tool: "question",
    callId: "new-question",
    status: "running" as const,
    state: { input: { questions: [{ question: "New?" }] } },
  };
  expect(
    await renderedObservation(ctx, "s", session, [{ id: "row", role: "assistant", parts: [pending] }]),
  ).toMatchObject({ observedChangeQuestionId: "new-question" });
  const inline = { ...pending, state: { input: { delivery: "async", questions: [{ question: "New?" }] } } };
  expect(
    await renderedObservation(ctx, "s", session, [{ id: "row", role: "assistant", parts: [inline] }]),
  ).toMatchObject({ observedChangeQuestionId: "new-question", observedChangeMessageIds: ["row"] });
});

test("a historical conversation without tracked positions establishes revision zero from displayed content", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { resources: { observeChange: async (_resource, stamp) => JSON.stringify(stamp) } },
  });
  const observed = await renderedObservation(ctx, "s", { createdAt: "old", status: "completed" }, [
    { id: "historical", role: "assistant", parts: [{ type: "text", text: "Previous work" }] },
  ]);
  expect(observed).toMatchObject({
    observedChange: JSON.stringify({ lineage: "conversation-v1/old", revision: "0" }),
    observedChangeMessageIds: ["historical"],
    observedChangeQuestionId: null,
  });
});
