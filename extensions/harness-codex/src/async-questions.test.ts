import { expect, test } from "bun:test";
import type { SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import { createAppServerItems } from "./app-server-items";
import { recoverCodexMessages } from "./history-reconciliation";
import { itemToMessage } from "./items";
import { createCodexStreamPipeline } from "./normalize-stream";
import { normalizeRollout } from "./rollout";

const questions = [
  { title: "Which color?", options: ["Blue", "Green"] },
  { title: "Who is it for?", options: null },
];
const nativeMessage = () =>
  normalizeRollout(
    [
      {
        type: "response_item",
        payload: {
          type: "function_call",
          name: "request_user_input_async",
          call_id: "async-1",
          arguments: JSON.stringify({ questions }),
        },
      },
      {
        type: "event_msg",
        payload: {
          type: "item_completed",
          item: {
            type: "AgentMessage",
            id: "async-1",
            content: [{ type: "Text", text: "Which color?" }],
            delivery: "async",
            questions,
          },
        },
      },
      {
        type: "response_item",
        payload: { type: "function_call_output", call_id: "async-1", output: '{"accepted":true}' },
      },
    ]
      .map((item) => JSON.stringify(item))
      .join("\n"),
  );

test("preserves async questions as pending shared question parts in live and recovered history", () => {
  const messages: SessionMessage[] = [];
  const adapter = createAppServerItems((item) => messages.push(itemToMessage(item, "live")!));
  adapter.receive({
    method: "item/completed",
    params: { item: { id: "async-1", type: "agentMessage", text: "Which color?", delivery: "async", questions } },
  });
  expect(messages[0]?.parts[0]).toMatchObject({
    tool: "question",
    callId: "async-1",
    status: "pending",
    state: {
      input: {
        delivery: "async",
        questions: [
          { question: "Which color?", options: [{ label: "Blue" }, { label: "Green" }], allowCustomAnswer: true },
          { question: "Who is it for?", options: [], allowCustomAnswer: true },
        ],
      },
    },
  });
  const native = nativeMessage();
  expect(native).toHaveLength(1);
  expect(native[0].parts).toEqual(messages[0].parts);
  const recovered = recoverCodexMessages({ knownMessages: messages, nativeMessages: native });
  expect(recovered.kind).toBe("recovered");
  if (recovered.kind === "recovered") expect(recovered.messages).toHaveLength(1);
});

test("keeps a steered user answer as a turn boundary so recovery does not duplicate the final answer", () => {
  const messages: SessionMessage[] = [];
  const pipeline = createCodexStreamPipeline(
    {
      getMessages: () => messages,
      push: (patch) => {
        messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
      },
    },
    { initialMessages: [{ id: "original-user", role: "user", parts: [{ type: "text", text: "Ask while working" }] }] },
  );
  const adapter = createAppServerItems((item) => pipeline.handleEvent({ type: "item.updated", item }), "original-user");
  for (const item of [
    {
      id: "native-original",
      type: "userMessage",
      clientId: "original-user",
      content: [{ type: "text", text: "Ask while working" }],
    },
    { id: "commentary", type: "agentMessage", text: "INDEPENDENT_WORK_DONE=391" },
    { id: "steered-user", type: "userMessage", content: [{ type: "text", text: "Which color?\nGreen" }] },
    { id: "final", type: "agentMessage", text: "ASYNC_OK Green" },
  ]) {
    adapter.receive({ method: "item/started", params: { item } });
    adapter.receive({ method: "item/completed", params: { item } });
  }
  expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "user", "assistant"]);
  const native = normalizeRollout(
    [
      { type: "UserMessage", id: "native-original", content: [{ text: "Ask while working" }] },
      { type: "AgentMessage", id: "commentary", content: [{ text: "INDEPENDENT_WORK_DONE=391" }] },
      { type: "UserMessage", id: "steered-user", content: [{ text: "Which color?\nGreen" }] },
      { type: "AgentMessage", id: "final", content: [{ text: "ASYNC_OK Green" }] },
    ]
      .map((item) => JSON.stringify({ type: "event_msg", payload: { type: "item_completed", item } }))
      .join("\n"),
  );
  const result = recoverCodexMessages({ knownMessages: messages, nativeMessages: native });
  expect(result.kind).toBe("recovered");
  if (result.kind === "recovered") {
    expect(
      result.messages
        .flatMap((message) => message.parts)
        .filter((part) => part.type === "text" && part.text === "ASYNC_OK Green"),
    ).toHaveLength(1);
    expect(result.messages).toHaveLength(4);
  }
});

test("keeps accepted async answers when native history still records their original delivery", () => {
  const native = nativeMessage();
  const part = native[0].parts[0] as ToolPart;
  const known = [
    {
      ...native[0],
      parts: [
        { ...part, status: "completed" as const, state: { ...part.state, output: { answers: [["Green"], ["Åsa"]] } } },
      ],
    },
  ];
  const result = recoverCodexMessages({ knownMessages: known, nativeMessages: native });
  expect(result.kind).toBe("recovered");
  if (result.kind === "recovered")
    expect(result.messages[0].parts[0]).toMatchObject({
      status: "completed",
      state: { output: { answers: [["Green"], ["Åsa"]] } },
    });
});
