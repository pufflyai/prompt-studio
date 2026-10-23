import { writeSync } from "node:fs";
import { createInterface } from "node:readline";

const emit = (message: unknown) => writeSync(1, `${JSON.stringify(message)}\n`);
const items: unknown[] = [];
const mode = process.env.PSTDIO_TEST_MODE;
for await (const line of createInterface({ input: process.stdin })) {
  const message = JSON.parse(line);
  const params = message.params;
  if (!message.method) continue;
  const reply = (result: unknown = {}) => emit({ id: message.id, result });
  const item = (value: unknown) => {
    items.push(value);
    for (const method of ["item/started", "item/completed"])
      emit({ method, params: { threadId: "thread", turnId: "turn", item: value } });
  };
  if (["initialize", "config/read", "thread/unsubscribe"].includes(message.method)) reply();
  if (["thread/start", "thread/resume"].includes(message.method))
    reply({ thread: { id: "thread", turns: [] }, model: "fixture" });
  if (message.method === "thread/goal/get") reply({ goal: null });
  if (message.method === "thread/read") reply({ thread: { turns: [{ id: "turn", status: "inProgress", items }] } });
  if (message.method === "turn/start") {
    reply({ turn: { id: "turn" } });
    emit({ method: "turn/started", params: { threadId: "thread", turn: { id: "turn" } } });
    if (mode !== "no-initial-echo") item({ type: "userMessage", id: "initial", clientId: null, content: params.input });
  }
  if (message.method === "turn/steer") {
    if (mode === "reject") {
      emit({ id: message.id, error: { code: -32600, message: "Turn is no longer active" } });
      continue;
    }
    if (mode === "ack-first") reply({ turnId: "turn" });
    item({
      type: "userMessage",
      id: "native-steering",
      clientId: params.clientUserMessageId,
      content: params.input,
    });
    item({ type: "agentMessage", id: "request", text: JSON.stringify(message) });
    if (mode === "lost-ack") process.exit(0);
    if (mode !== "ack-first") reply({ turnId: "turn" });
  }
  if (message.method === "turn/interrupt") {
    reply();
    emit({
      method: "turn/completed",
      params: { threadId: "thread", turn: { id: "turn", status: "interrupted" } },
    });
  }
}
