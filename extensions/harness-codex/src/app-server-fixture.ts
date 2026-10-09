import { appendFileSync, writeSync } from "node:fs";
import { createInterface } from "node:readline";
import { setTimeout } from "node:timers/promises";

// A real stdio peer using the captured Codex 0.139 request and reply protocol.
const emit = (value: unknown) => writeSync(1, `${JSON.stringify(value)}\n`);
const complete = () => {
  emit({ method: "item/completed", params: { item: { id: "answer", type: "agentMessage", text: "Hi, colleague" } } });
  emit({ method: "turn/completed", params: { turn: { id: "turn-1", status: "completed", error: null } } });
};
emit({ type: "thread.started", thread_id: "thread-fixture" });
for await (const line of createInterface({ input: process.stdin })) {
  let message: { id?: string | number; method?: string; params?: Record<string, unknown>; result?: unknown };
  try {
    message = JSON.parse(line);
  } catch {
    complete();
    process.exit(0);
  }
  if (message.method === "initialize") emit({ id: message.id, result: {} });
  if (message.method === "thread/goal/get") emit({ id: message.id, result: { goal: null } });
  if (message.method === "thread/read" && process.env.PSTDIO_TEST_MODE === "plan-approval-stalled") {
    emit({ method: "fixture/read-blocked" });
    continue;
  }
  if (message.method === "thread/read")
    emit({
      id: message.id,
      result: {
        thread: {
          turns: process.env.PSTDIO_TEST_MODE?.startsWith("plan-approval")
            ? [
                {
                  id: "plan-turn",
                  status: "completed",
                  items: [{ type: "plan", id: "proposal", text: "Build the agreed feature." }],
                },
              ]
            : [],
        },
      },
    });
  if (message.method === "thread/start" || message.method === "thread/resume") {
    emit({ id: message.id, result: { thread: { id: "thread-fixture", path: process.env.PSTDIO_TEST_TRANSCRIPT } } });
    emit({
      method: "item/completed",
      params: { item: { id: "config", type: "agentMessage", text: JSON.stringify(message) } },
    });
  }
  if (message.method === "turn/interrupt") {
    emit({ id: message.id, result: {} });
    emit({ method: "turn/completed", params: { turn: { id: "turn-1", status: "interrupted" } } });
  }
  if (message.method === "turn/start") {
    if (process.env.PSTDIO_TEST_MODE === "plan-approval-lost-ack") process.exit(0);
    if (process.env.PSTDIO_TEST_MODE === "plan-approval-rejected") {
      emit({ id: message.id, error: { code: -32000, message: "Implementation was rejected" } });
      continue;
    }
    if (process.env.PSTDIO_TEST_MODE === "protocol-error") {
      emit({ method: "item/started", params: { item: null } });
      emit({ id: message.id, result: { turn: { id: "turn-1" } } });
      continue;
    }
    emit({ id: message.id, result: { turn: { id: "turn-1" } } });
    emit({
      method: "item/completed",
      params: { item: { id: "input", type: "agentMessage", text: JSON.stringify(message.params) } },
    });
    emit({ method: "turn/started", params: { turn: { id: "turn-1" } } });
    if (process.env.PSTDIO_TEST_MODE === "close") {
      process.exit(0);
    }
    if (["complete", "plan-approval"].includes(process.env.PSTDIO_TEST_MODE ?? "")) {
      complete();
      continue;
    }
    if (process.env.PSTDIO_TEST_MODE === "fail") {
      emit({
        method: "turn/completed",
        params: { turn: { id: "turn-1", status: "failed", error: { message: "Provider failed" } } },
      });
      continue;
    }
    if (process.env.PSTDIO_TEST_MODE?.startsWith("async")) {
      emit({
        method: "item/completed",
        params: {
          item: {
            id: "async-1",
            type: "agentMessage",
            text: "Which greeting?",
            delivery: "async",
            questions: [
              { title: "Which greeting?", options: ["Hi", "Hello"] },
              { title: "Who is it for?", options: null },
            ],
          },
        },
      });
      if (process.env.PSTDIO_TEST_MODE === "async-complete") complete();
      continue;
    }
    emit({
      id: 0,
      method: "item/tool/requestUserInput",
      params: {
        threadId: "thread-fixture",
        turnId: "turn-1",
        itemId: "question-1",
        questions: [
          {
            id: "greeting",
            header: "Greeting",
            question: "Which greeting?",
            isOther: true,
            isSecret: false,
            options: [
              { label: "Hi", description: "An informal greeting." },
              { label: "Hello", description: "A formal greeting." },
            ],
          },
          {
            id: "audience",
            header: "Audience",
            question: "Who is it for?",
            isOther: true,
            isSecret: false,
            options: null,
          },
        ],
      },
    });
  }
  if (message.method === "turn/steer") {
    if (process.env.PSTDIO_TEST_MODE === "async-reject") {
      emit({ id: message.id, error: { code: -32600, message: "Steer rejected" } });
      continue;
    }
    if (message.params?.threadId !== "thread-fixture" || message.params?.expectedTurnId !== "turn-1") process.exit(2);
    emit({
      method: "item/completed",
      params: { item: { id: "steer", type: "agentMessage", text: JSON.stringify(message) } },
    });
    await setTimeout(20);
    emit({ id: message.id, result: { turnId: "turn-1" } });
    complete();
  }
  if (message.id === 0 && !message.method) {
    const expected = {
      answers:
        process.env.PSTDIO_TEST_MODE === "skip"
          ? {}
          : { greeting: { answers: ["Hi"] }, audience: { answers: ["colleague"] } },
    };
    if (JSON.stringify(message.result) !== JSON.stringify(expected)) process.exit(2);
    emit({ method: "serverRequest/resolved", params: { threadId: "thread-fixture", requestId: 0 } });
    if (process.env.PSTDIO_TEST_MODE !== "cleared") {
      await setTimeout(20);
      const output = process.env.PSTDIO_TEST_MODE === "mismatch" ? { answers: {} } : expected;
      appendFileSync(
        process.env.PSTDIO_TEST_TRANSCRIPT!,
        `${JSON.stringify({
          type: "response_item",
          payload: { type: "function_call_output", call_id: "question-1", output: JSON.stringify(output) },
        })}\n`,
      );
    }
    complete();
  }
}
