import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type {
  HarnessAttachment,
  HarnessEventSink,
  HarnessExit,
  HarnessSession,
  SessionMessage,
} from "@pstdio/sdk/extensions";
import { createCodexStreamPipeline } from "./normalize-stream";
import { parseThreadEvent } from "./types";

// Sessions run unattended in host-managed worktrees, so approvals and the codex
// sandbox are bypassed — the same posture as the Claude Code harness.
const BASE_ARGS = ["exec", "--json", "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox"];

const DEFAULT_CODEX_PARAMS = {
  model_reasoning_effort: "medium",
};

const CONFIG_PARAM_KEYS = ["model_reasoning_effort"] as const;

type CodexParamKey = (typeof CONFIG_PARAM_KEYS)[number];
type CodexParams = Partial<Record<CodexParamKey, string | boolean>>;

const modelArgs = (model?: string | null) => (model ? ["--model", model] : []);

const configArgs = (params?: CodexParams) => {
  const values = { ...DEFAULT_CODEX_PARAMS, ...params };
  return CONFIG_PARAM_KEYS.flatMap((key) => ["-c", `${key}=${values[key]}`]);
};

// Trailing "-" makes codex read the prompt from stdin, which avoids argv limits.
export const buildStartArgs = (input: { model?: string | null; params?: CodexParams }) => [
  ...BASE_ARGS,
  ...configArgs(input.params),
  ...modelArgs(input.model),
  "-",
];

export const buildResumeArgs = (input: { agentSessionId: string; model?: string | null; params?: CodexParams }) => [
  ...BASE_ARGS,
  ...configArgs(input.params),
  ...modelArgs(input.model),
  "resume",
  input.agentSessionId,
  "-",
];

const sendPrompt = (stdin: Writable, prompt: string) => {
  stdin.write(prompt);
  stdin.end();
};

const promptWithAttachmentManifest = (prompt: string, attachments: HarnessAttachment[] = []) => {
  if (attachments.length === 0) return prompt;

  const lines = [
    prompt,
    "",
    "<session-attachments>",
    ...attachments.map(
      (attachment) =>
        `- name=${JSON.stringify(attachment.fileName)} path=${JSON.stringify(attachment.localPath)} mime=${JSON.stringify(
          attachment.mimeType,
        )} size=${attachment.sizeBytes}`,
    ),
    "</session-attachments>",
  ];

  return lines.join("\n");
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

const userMessageFor = (prompt: string, attachments: HarnessAttachment[] = []): SessionMessage => {
  const createdAt = Date.now();
  return {
    id: `user-${createdAt}`,
    role: "user",
    createdAt,
    parts: [
      { type: "text", text: prompt },
      ...attachments.map((attachment) => ({
        type: "file" as const,
        fileId: attachment.fileId,
        filename: attachment.fileName,
        mediaType: attachment.mimeType ?? undefined,
        size: attachment.sizeBytes,
        url: attachment.url,
      })),
    ],
  };
};

type RunStreamInput = {
  prompt: string;
  attachments?: HarnessAttachment[];
  events: HarnessEventSink;
  messageOffset?: number;
  onThreadStarted?: (threadId: string) => void;
};

const runStream = async (stdout: Readable, input: RunStreamInput) => {
  const pipeline = createCodexStreamPipeline(input.events, {
    initialMessages: [userMessageFor(input.prompt, input.attachments)],
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
  attachments?: HarnessAttachment[];
  model?: string | null;
  params?: CodexParams;
  cwd?: string;
  env?: Record<string, string>;
  events: HarnessEventSink;
};

export const startCodexSession = async (input: StartSpawnInput, deps: SpawnDeps = defaultDeps) => {
  const child = deps.spawnProcess(buildStartArgs(input), { cwd: input.cwd, env: input.env });

  sendPrompt(child.stdin, promptWithAttachmentManifest(input.prompt, input.attachments));

  let resolveThreadId: (threadId: string) => void;
  const threadId = new Promise<string>((resolve) => {
    resolveThreadId = resolve;
  });

  const pipelineDone = runStream(child.stdout, {
    prompt: input.prompt,
    attachments: input.attachments,
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

  sendPrompt(child.stdin, promptWithAttachmentManifest(input.prompt, input.attachments));

  const pipelineDone = runStream(child.stdout, {
    prompt: input.prompt,
    attachments: input.attachments,
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
