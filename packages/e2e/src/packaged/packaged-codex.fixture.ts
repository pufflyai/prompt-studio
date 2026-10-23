import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const log = process.env.PSTDIO_CODEX_PEER_LOG!;
const emit = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`);
const threads = new Map<string, { id: string; turns: Array<{ id: string; status: string; items: unknown[] }> }>();
const goals = new Map<string, { status: string }>();
let sequence = 0;
if (process.argv.includes("--version")) {
  console.log("codex-cli 0.157.0");
  process.exit(0);
}
for await (const line of createInterface({ input: process.stdin })) {
  const message = JSON.parse(line);
  if (!message.method) continue;
  appendFileSync(log, `${JSON.stringify({ pid: process.pid, ...message })}\n`);
  const params = message.params;
  let result: unknown = {};
  let startedTurn = false;
  if (message.method === "model/list") result = { data: [], nextCursor: null };
  if (message.method === "thread/start") {
    const id = `thread-${++sequence}`;
    threads.set(id, { id, turns: [] });
    result = { thread: { id, path: null, turns: [] }, model: "fixture" };
  }
  if (message.method === "thread/resume")
    result = { thread: { ...threads.get(params.threadId), path: null }, model: "fixture" };
  if (message.method === "thread/read") result = { thread: threads.get(params.threadId) };
  if (message.method === "thread/goal/get") {
    const thread = threads.get(params.threadId)!;
    if (process.env.PSTDIO_CODEX_PEER_STEER_GOAL === "1" && thread.turns.length === 0) {
      const turn = { id: `turn-${++sequence}`, status: "inProgress", items: [] };
      thread.turns.push(turn);
      goals.set(params.threadId, { status: "active" });
      emit({ method: "turn/started", params: { threadId: params.threadId, turn } });
    }
    result = { goal: goals.get(params.threadId) ?? null };
  }
  if (message.method === "thread/goal/set") {
    const goal = { status: params.status };
    goals.set(params.threadId, goal);
    result = { goal };
  }
  if (message.method === "turn/start") {
    const thread = threads.get(params.threadId)!;
    let turn = thread.turns.find((turn) => turn.status === "inProgress");
    if (!turn) {
      turn = { id: `turn-${++sequence}`, status: "inProgress", items: [] };
      thread.turns.push(turn);
      startedTurn = true;
    }
    result = { turn };
  }
  if (message.method === "turn/steer") {
    const turn = threads.get(params.threadId)!.turns.find((turn) => turn.status === "inProgress");
    if (!turn || turn.id !== params.expectedTurnId) {
      emit({ id: message.id, error: { code: -32600, message: "No matching active turn" } });
      continue;
    }
    const item = {
      id: `user-${++sequence}`,
      type: "userMessage",
      clientId: params.clientUserMessageId,
      content: params.input,
    };
    turn.items.push(item);
    emit({ method: "item/completed", params: { threadId: params.threadId, turnId: turn.id, item } });
    result = { turnId: turn.id };
  }
  if (message.id !== undefined) emit({ id: message.id, result });
  if (message.method === "turn/start") {
    const turn = threads.get(params.threadId)!.turns.at(-1)!;
    if (startedTurn) emit({ method: "turn/started", params: { threadId: params.threadId, turn } });
    emit({
      method: "item/completed",
      params: {
        threadId: params.threadId,
        turnId: turn.id,
        item: { id: "answer", type: "agentMessage", text: params.input[0].text },
      },
    });
  }
  if (message.method === "turn/interrupt") {
    const turn = threads.get(params.threadId)!.turns.find((turn) => turn.id === params.turnId)!;
    turn.status = "interrupted";
    emit({ method: "turn/completed", params: { threadId: params.threadId, turn } });
  }
}
