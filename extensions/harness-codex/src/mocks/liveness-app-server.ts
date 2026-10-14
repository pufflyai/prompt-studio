// A stand-in Codex app-server: it stays quiet during a turn, can fill stderr past the pipe buffer, and can fail.
import { writeSync } from "node:fs";

// Synchronous writes reach the pipe before process.exit, so the last events are never lost.
const emit = (event: unknown) => writeSync(1, `${JSON.stringify(event)}\n`);

for await (const line of console) {
  const request = JSON.parse(line);
  if (request.method === "initialize") emit({ id: request.id, result: {} });
  if (request.method === "config/read") emit({ id: request.id, result: { config: {} } });
  if (request.method === "thread/goal/get") emit({ id: request.id, result: { goal: null } });
  if (request.method === "thread/read") emit({ id: request.id, result: { thread: { id: "quiet-thread", turns: [] } } });
  if (request.method === "thread/start" || request.method === "thread/resume")
    emit({ id: request.id, result: { thread: { id: "quiet-thread", path: null } } });
  if (request.method !== "turn/start") continue;
  emit({ id: request.id, result: { turn: { id: "quiet-turn", status: "inProgress" } } });
  emit({
    method: "turn/started",
    params: { threadId: "quiet-thread", turn: { id: "quiet-turn", status: "inProgress" } },
  });
  await Bun.sleep(150);
  if (process.env.LIVENESS_STDERR)
    await new Promise<void>((resolve, reject) =>
      process.stderr.write("x".repeat(2 * 1024 * 1024), (error) => (error ? reject(error) : resolve())),
    );
  emit({
    method: "item/completed",
    params: {
      threadId: "quiet-thread",
      turnId: "quiet-turn",
      item: { id: "answer", type: "agentMessage", text: "quiet work completed" },
    },
  });
  const code = Number(process.env.LIVENESS_EXIT_CODE ?? 0);
  if (!code)
    emit({
      method: "turn/completed",
      params: { threadId: "quiet-thread", turn: { id: "quiet-turn", status: "completed" } },
    });
  process.exit(code);
}
