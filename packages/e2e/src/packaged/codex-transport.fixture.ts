import { existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

if (process.argv.includes("--version")) {
  console.log("codex-cli 0.160.1");
  process.exit(0);
}
process.on("SIGTERM", () => process.exit(1));
const threadId = "transport-fixture";
const emit = (value: unknown) => console.log(JSON.stringify(value));
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  let result: unknown = {};
  if (request.method === "model/list") result = { data: [{ id: "gpt-5.5", isDefault: true }] };
  if (["thread/start", "thread/resume", "thread/read"].includes(request.method))
    result = { thread: { id: threadId, path: null, turns: [] } };
  if (request.method === "thread/goal/get") result = { goal: null };
  if (request.method === "turn/start") result = { turn: { id: "turn-1" } };
  if (request.id !== undefined) emit({ id: request.id, result });
  if (request.method !== "turn/start") continue;
  writeFileSync(process.env.CODEX_TRANSPORT_PID!, String(process.pid));
  const release = setInterval(() => {
    if (!existsSync(process.env.CODEX_TRANSPORT_RELEASE!)) return;
    clearInterval(release);
    if (request.params.input[0].text === "provider failure") {
      emit({
        method: "turn/completed",
        params: { threadId, turn: { id: "turn-1", status: "failed", error: { message: "Provider failed" } } },
      });
      return;
    }
    process.exit(1);
  }, 10);
}
