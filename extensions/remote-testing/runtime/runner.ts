import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runCommand } from "./command";
import { parseRequest, RESULT_MARKER, type RunRequest, type RunResult } from "./protocol";
import { installSource } from "./source";

// A test runner that speaks the Pi RPC protocol, so PocketCoder's native Pi session
// adapter drives it: one prompt line in, Pi events out, and `agent_settled` at the end.
// Every prompt is one run request; there is no model.

const root = process.env.REMOTE_TEST_WORKSPACE ?? "/workspace";
const emit = (event: Record<string, unknown>) => process.stdout.write(`${JSON.stringify(event)}\n`);
const text = (value: string) => ({ content: [{ type: "text", text: value }] });

async function step<T>(id: string, name: string, args: Record<string, unknown>, work: () => Promise<[T, string]>) {
  emit({ type: "tool_execution_start", toolCallId: id, toolName: name, args });
  try {
    const [value, summary] = await work();
    emit({ type: "tool_execution_end", toolCallId: id, result: text(summary), isError: false });
    return value;
  } catch (error) {
    emit({ type: "tool_execution_end", toolCallId: id, result: text(message(error)), isError: true });
    throw error;
  }
}

async function run(request: RunRequest, signal: AbortSignal): Promise<RunResult> {
  const started = Date.now();
  const repo = join(root, "repo");
  const logPath = join(root, "runs", `${request.runId}.log`);
  await mkdir(join(root, "runs"), { recursive: true });
  await mkdir(join(root, "tmp"), { recursive: true });
  await step("source", "download_source", {}, async () => {
    const bytes = await installSource(request.source.url, request.source.sha256, repo, signal);
    return [bytes, `Installed ${bytes} source bytes into ${repo}`];
  });

  let lastUpdate = 0;
  emit({ type: "tool_execution_start", toolCallId: "run", toolName: "bash", args: { command: request.command } });
  const outcome = await runCommand({
    command: request.command,
    cwd: repo,
    logPath,
    timeoutSeconds: request.timeoutSeconds,
    signal,
    // Test suites write large temporary trees; /tmp is a small memory volume.
    env: {
      ...process.env,
      DOCKER_HOST: "unix:///workspace/.docker/run/docker.sock",
      CI: "1",
      TMPDIR: join(root, "tmp"),
      BUN_INSTALL_CACHE_DIR: join(root, ".bun-cache"),
    },
    onOutput(tail) {
      if (Date.now() - lastUpdate < 2000) return;
      lastUpdate = Date.now();
      emit({ type: "tool_execution_update", toolCallId: "run", partialResult: text(tail) });
    },
  });
  emit({
    type: "tool_execution_end",
    toolCallId: "run",
    result: text(outcome.tail),
    isError: outcome.exitCode !== 0,
  });

  const logUploaded = await step("log", "upload_log", {}, async () => {
    const response = await fetch(request.log.url, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: Bun.file(logPath),
    });
    if (!response.ok) throw new Error(`Log upload failed with HTTP ${response.status}`);
    return [true, "Uploaded the full log"];
  }).catch(() => false);

  return {
    runId: request.runId,
    exitCode: outcome.exitCode,
    durationMs: Date.now() - started,
    timedOut: outcome.timedOut,
    logUploaded,
  };
}

function statusLine(result: RunResult) {
  if (result.error) return `Run failed: ${result.error}`;
  if (result.timedOut) return "Command timed out.";
  return `Command exited with ${result.exitCode}.`;
}

function finish(result: RunResult, aborted: boolean) {
  const status = statusLine(result);
  emit({ type: "message_start", message: { role: "assistant" } });
  emit({
    type: "message_end",
    message: {
      role: "assistant",
      content: [{ type: "text", text: `${status}\n${RESULT_MARKER}${JSON.stringify(result)}` }],
      stopReason: aborted ? "aborted" : "stop",
    },
  });
  emit({ type: "agent_settled" });
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const abort = new AbortController();
  let active: Promise<void> | undefined;
  let buffer = "";
  for await (const chunk of Bun.stdin.stream().pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    let index = buffer.indexOf("\n");
    while (index >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      index = buffer.indexOf("\n");
      if (!line) continue;
      const command = JSON.parse(line) as { type: string; message?: string };
      if (command.type === "abort") abort.abort();
      if (command.type !== "prompt" || active) continue;
      const started = Date.now();
      active = (async () => {
        let request: RunRequest | undefined;
        try {
          request = parseRequest(command.message ?? "");
          finish(await run(request, abort.signal), abort.signal.aborted);
        } catch (error) {
          const result = {
            runId: request?.runId ?? null,
            exitCode: null,
            durationMs: Date.now() - started,
            timedOut: false,
            logUploaded: false,
            error: message(error),
          };
          finish(result, abort.signal.aborted);
        }
      })();
    }
  }
  await active;
}

if (import.meta.main) await main();
