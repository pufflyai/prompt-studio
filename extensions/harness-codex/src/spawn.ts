import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { HarnessEventSink, HarnessExit, HarnessSession, SessionMessage } from "@pstdio/sdk/extensions";
import { createCodexStreamPipeline } from "./normalize-stream";
import { parseThreadEvent } from "./types";

// Sessions run unattended in host-managed worktrees, so approvals and the codex
// sandbox are bypassed — the same posture as the Claude Code harness.
const BASE_ARGS = ["exec", "--json", "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox"];

const modelArgs = (model?: string | null) => (model ? ["--model", model] : []);

// Trailing "-" makes codex read the prompt from stdin, which avoids argv limits.
export const buildStartArgs = (input: { model?: string | null }) => [...BASE_ARGS, ...modelArgs(input.model), "-"];

export const buildResumeArgs = (input: { agentSessionId: string; model?: string | null }) => [
  ...BASE_ARGS,
  ...modelArgs(input.model),
  "resume",
  input.agentSessionId,
  "-",
];

const sendPrompt = (stdin: Writable, prompt: string) => {
  stdin.write(prompt);
  stdin.end();
};

type SpawnedChild = {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  pid?: number;
  kill(): void;
  onExit: Promise<{ code: number | null; signal: string | null }>;
};

export type SpawnDeps = {
  spawnProcess: (args: string[], options?: { cwd?: string; env?: Record<string, string> }) => SpawnedChild;
};

const defaultSpawnProcess = (
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> },
): SpawnedChild => {
  const child = spawn("codex", args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
  }) as ChildProcess;

  child.on("error", (err) => {
    console.error("[codex:spawn] child process error:", err);
  });

  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  return {
    stdin: child.stdin!,
    stdout: child.stdout!,
    stderr: child.stderr!,
    pid: child.pid,
    kill: () => child.kill(),
    onExit,
  };
};

const defaultDeps: SpawnDeps = { spawnProcess: defaultSpawnProcess };

const toHarnessExit = (exit: { code: number | null; signal: string | null }): HarnessExit => {
  if (exit.signal === "SIGTERM" || exit.signal === "SIGINT") return { status: "cancelled" };
  return exit.code === 0 ? { status: "completed" } : { status: "failed" };
};

const userMessageFor = (prompt: string): SessionMessage => ({
  id: `user-${Date.now()}`,
  role: "user",
  parts: [{ type: "text", text: prompt }],
});

type RunStreamInput = {
  prompt: string;
  events: HarnessEventSink;
  messageOffset?: number;
  onThreadStarted?: (threadId: string) => void;
};

const runStream = async (stdout: Readable, input: RunStreamInput) => {
  const pipeline = createCodexStreamPipeline(input.events, {
    initialMessages: [userMessageFor(input.prompt)],
    indexOffset: input.messageOffset ?? 0,
  });

  const reader = createInterface({ input: stdout, crlfDelay: Number.POSITIVE_INFINITY });

  for await (const line of reader) {
    const event = parseThreadEvent(line);
    if (!event) continue;

    if (event.type === "thread.started") {
      input.onThreadStarted?.(event.thread_id);
      continue;
    }

    pipeline.handleEvent(event);
  }
};

export type StartSpawnInput = {
  prompt: string;
  model?: string | null;
  cwd?: string;
  env?: Record<string, string>;
  events: HarnessEventSink;
};

export const startCodexSession = async (input: StartSpawnInput, deps: SpawnDeps = defaultDeps) => {
  const child = deps.spawnProcess(buildStartArgs(input), { cwd: input.cwd, env: input.env });

  sendPrompt(child.stdin, input.prompt);

  let resolveThreadId: (threadId: string) => void;
  const threadId = new Promise<string>((resolve) => {
    resolveThreadId = resolve;
  });

  const pipelineDone = runStream(child.stdout, {
    prompt: input.prompt,
    events: input.events,
    onThreadStarted: (id) => resolveThreadId(id),
  });

  const streamEnded = pipelineDone.then(() => {
    throw new Error("Codex stream ended without providing a thread id");
  });
  // The rejection is only meaningful while racing; swallow it once the thread id won.
  streamEnded.catch(() => {});

  const agentSessionId = await Promise.race([threadId, streamEnded]);

  const done = Promise.all([child.onExit, pipelineDone]).then(([exit]) => toHarnessExit(exit));

  return {
    agentSessionId,
    done,
    stop: child.kill,
    timeoutStrategy: "activity",
    pid: child.pid,
  } satisfies HarnessSession;
};

export type ResumeSpawnInput = StartSpawnInput & {
  agentSessionId: string;
  messageOffset?: number;
};

export const resumeCodexSession = (input: ResumeSpawnInput, deps: SpawnDeps = defaultDeps) => {
  const child = deps.spawnProcess(buildResumeArgs(input), { cwd: input.cwd, env: input.env });

  sendPrompt(child.stdin, input.prompt);

  const pipelineDone = runStream(child.stdout, {
    prompt: input.prompt,
    events: input.events,
    messageOffset: input.messageOffset ?? 0,
  });

  const done = Promise.all([child.onExit, pipelineDone]).then(([exit]) => toHarnessExit(exit));

  return {
    agentSessionId: input.agentSessionId,
    done,
    stop: child.kill,
    timeoutStrategy: "activity",
    pid: child.pid,
  } satisfies HarnessSession;
};
