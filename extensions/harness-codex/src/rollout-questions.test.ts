import { expect, test } from "bun:test";
import type { ToolPart } from "@pstdio/sdk/extensions";
import { recoverCodexMessages } from "./history-reconciliation";
import { normalizeRollout } from "./rollout";

const questions = [{ id: "audience", header: "Audience", question: "Who is it for?", options: [{ label: "Team" }] }];
const call = {
  type: "response_item",
  payload: {
    type: "function_call",
    name: "request_user_input",
    call_id: "question-1",
    arguments: JSON.stringify({ questions }),
  },
};
const output = {
  type: "response_item",
  payload: {
    type: "function_call_output",
    call_id: "question-1",
    output: JSON.stringify({ answers: { audience: { answers: ["colleague"] } } }),
  },
};
const text = {
  type: "event_msg",
  payload: {
    type: "item_completed",
    item: { type: "AgentMessage", id: "answer", content: [{ type: "text", text: "Hi, colleague" }] },
  },
};
const transcript = (...records: unknown[]) => records.map((record) => JSON.stringify(record)).join("\n");

test("recovers a pending native question with the shared question contract", () => {
  const part = normalizeRollout(transcript(call))[0].parts[0] as ToolPart;
  expect(part).toMatchObject({
    tool: "question",
    callId: "question-1",
    status: "pending",
    state: { input: { questions: [{ id: "audience", allowCustomAnswer: false, options: [{ label: "Team" }] }] } },
  });
});

test("keeps an answered native question when the turn also records completed items", () => {
  const messages = normalizeRollout(transcript(call, output, text));
  const part = messages.flatMap((m) => m.parts).find((p) => p.type === "tool") as ToolPart;
  expect(part).toMatchObject({ tool: "question", status: "completed" });
  expect(part.state?.output).toContain("colleague");
  expect(messages.at(-1)?.parts).toEqual([{ type: "text", text: "Hi, colleague" }]);
});

test("keeps identical questions with distinct native call IDs separate during recovery", () => {
  const next = { ...call, payload: { ...call.payload, call_id: "question-2" } };
  const known = normalizeRollout(transcript(call, next));
  const result = recoverCodexMessages({
    knownMessages: known,
    nativeMessages: normalizeRollout(transcript(call, output, next)),
  });
  expect(result.kind).toBe("recovered");
  if (result.kind !== "recovered") return;
  expect(result.messages.map((message) => message.parts[0])).toMatchObject([
    { callId: "question-1", status: "completed" },
    { callId: "question-2", status: "pending" },
  ]);
});

test("recovers a missed reply onto the saved question identity without reopening answered history", async () => {
  const known = normalizeRollout(transcript(call));
  known[0].id = "saved-question";
  const livePart = known[0].parts[0] as ToolPart;
  livePart.state!.input = {
    questions: [{ id: "audience", question: "Who is it for?", options: [{ label: "Team" }], allowCustomAnswer: true }],
  };
  const native = normalizeRollout(transcript(call, output, text));
  const result = recoverCodexMessages({ knownMessages: known, nativeMessages: native });
  expect(result.kind).toBe("recovered");
  if (result.kind !== "recovered") return;
  const recovered = result.messages;
  const part = recovered[0].parts[0] as ToolPart;
  expect(recovered[0].id).toBe("saved-question");
  expect(part.state?.input).toEqual(livePart.state?.input);
  expect(part).toMatchObject({ callId: "question-1", status: "completed" });
  expect(part.state?.output).toContain("colleague");
  expect(
    recoverCodexMessages({ knownMessages: recovered, nativeMessages: normalizeRollout(transcript(call)) }),
  ).toEqual({ kind: "recovered", messages: recovered });
});
