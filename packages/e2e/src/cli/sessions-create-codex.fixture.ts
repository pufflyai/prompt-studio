import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

if (process.argv.includes("--version")) {
  console.log("codex-cli 0.160.1");
  process.exit(0);
}
const threadId = "codex-e2e-thread";
const turns: Array<{ id: string; status: string; items: unknown[] }> = [];
const emit = (event: unknown) => console.log(JSON.stringify(event));
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.method === "initialize") emit({ id: request.id, result: {} });
  if (["thread/start", "thread/resume", "thread/read"].includes(request.method))
    emit({ id: request.id, result: { thread: { id: threadId, path: null, turns } } });
  if (request.method === "thread/goal/get") emit({ id: request.id, result: { goal: null } });
  if (request.method === "model/list")
    emit({
      id: request.id,
      result: { data: [{ id: "gpt-5.5", displayName: "Test model", isDefault: true }], nextCursor: null },
    });
  if (request.method !== "turn/start") continue;
  appendFileSync(
    process.env.CODEX_E2E_PROMPTS!,
    `${request.params.input.map((part: { text: string }) => part.text).join("\n")}\n`,
  );
  const turnId = `turn-${request.id}`;
  const user = { id: `user-${turnId}`, type: "userMessage", content: request.params.input };
  const answer = { id: "item_0", type: "agentMessage", text: "done" };
  turns.push({ id: turnId, status: "completed", items: [user, answer] });
  emit({ id: request.id, result: { turn: { id: turnId } } });
  emit({ method: "item/started", params: { threadId, turnId, item: user } });
  emit({ method: "item/completed", params: { threadId, turnId, item: answer } });
  emit({ method: "turn/completed", params: { threadId, turn: { id: turnId, status: "completed" } } });
}
