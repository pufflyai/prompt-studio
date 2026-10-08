import { expect, test } from "bun:test";
import type { SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import { createAppServerItems } from "./app-server-items";
import { itemToMessage } from "./items";
import { createNativeProjection, nativeItemMessage, recoverNativeHistory } from "./native-history";

const questions = [
  { title: "Which color?", options: ["Blue", "Green"] },
  { title: "Who is it for?", options: null },
];
const nativeMessage = () => [
  nativeItemMessage(
    { type: "agentMessage", id: "async-1", text: "Which color?", delivery: "async", questions } as Parameters<
      typeof nativeItemMessage
    >[0],
    "one",
  )!,
];

test("preserves async questions as pending shared question parts in live and recovered history", () => {
  const messages: SessionMessage[] = [];
  const adapter = createAppServerItems((item) => messages.push(itemToMessage(item, "codex-one")!));
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
  expect(native[0].parts).toEqual(messages[0].parts);
  expect(recoverNativeHistory({ knownMessages: messages, nativeMessages: native }).messages).toHaveLength(1);
});

test("keeps a steered user answer as a turn boundary so recovery does not duplicate the final answer", () => {
  const messages: SessionMessage[] = [];
  const projection = createNativeProjection(
    {
      getMessages: () => messages,
      push: (patch) => {
        messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
      },
    },
    { id: "original-user", role: "user", parts: [{ type: "text", text: "Ask while working" }] },
  );
  const items = [
    { id: "native-original", type: "userMessage", content: [{ type: "text", text: "Ask while working" }] },
    { id: "commentary", type: "agentMessage", text: "INDEPENDENT_WORK_DONE=391" },
    { id: "steered-user", type: "userMessage", content: [{ type: "text", text: "Which color?\nGreen" }] },
    { id: "final", type: "agentMessage", text: "ASYNC_OK Green" },
  ] as Parameters<typeof nativeItemMessage>[0][];
  for (const item of items) {
    projection.receive(item, "one");
    projection.receive(item, "one");
  }
  expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "user", "assistant"]);
  const native = items.map((item) => nativeItemMessage(item, "one")!);
  const result = recoverNativeHistory({ knownMessages: messages, nativeMessages: native });
  expect(
    result.messages
      .flatMap((message) => message.parts)
      .filter((part) => part.type === "text" && part.text === "ASYNC_OK Green"),
  ).toHaveLength(1);
  expect(result.messages).toHaveLength(4);
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
  const result = recoverNativeHistory({ knownMessages: known, nativeMessages: native });
  expect(result.messages[0].parts[0]).toMatchObject({
    status: "completed",
    state: { output: { answers: [["Green"], ["Åsa"]] } },
  });
});
