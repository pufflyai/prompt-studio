const provider = process.argv[2];

export {};

const emit = (event: unknown) => process.stdout.write(`${JSON.stringify(event)}\n`);
if (provider === "codex") {
  for await (const line of console) {
    const request = JSON.parse(line);
    if (request.method === "initialize") emit({ id: request.id, result: {} });
    if (request.method === "thread/start" || request.method === "thread/resume")
      emit({ id: request.id, result: { thread: { id: "quiet-thread", path: null } } });
    if (request.method !== "turn/start") continue;
    emit({ id: request.id, result: {} });
    await Bun.sleep(150);
    if (process.env.LIVENESS_STDERR)
      await new Promise<void>((resolve, reject) =>
        process.stderr.write("x".repeat(2 * 1024 * 1024), (error) => (error ? reject(error) : resolve())),
      );
    emit({
      method: "item/completed",
      params: { item: { id: "answer", type: "agentMessage", text: "quiet work completed" } },
    });
    const code = Number(process.env.LIVENESS_EXIT_CODE ?? 0);
    if (!code) emit({ method: "turn/completed", params: { turn: { status: "completed" } } });
    process.exit(code);
  }
} else {
  for await (const line of console) {
    if (line.trim()) break;
  }
  emit({ type: "system", session_id: "quiet-thread" });
  await Bun.sleep(150);
  if (process.env.LIVENESS_STDERR)
    await new Promise<void>((resolve, reject) =>
      process.stderr.write("x".repeat(2 * 1024 * 1024), (error) => (error ? reject(error) : resolve())),
    );
  emit({ type: "content_block_delta", delta: { type: "text_delta", text: "quiet work completed" } });
  emit({ type: "result", usage: {} });
  process.exitCode = Number(process.env.LIVENESS_EXIT_CODE ?? 0);
}
