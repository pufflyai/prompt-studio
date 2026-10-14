// A stand-in Claude CLI process: it stays quiet, can fill stderr past the pipe buffer, and can fail.
export {};

const emit = (event: unknown) => process.stdout.write(`${JSON.stringify(event)}\n`);

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
