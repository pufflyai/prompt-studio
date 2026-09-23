import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { win32 } from "node:path";
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

// On Windows, `npm i -g @openai/codex` only puts a `codex.cmd` shim on PATH.
// This harness pipes stdio for a long-lived JSON protocol, so we want the real
// executable rather than an extra `cmd.exe` layer between us and the process.
// The vendored layout below is best-effort and tracks @openai/codex's current
// packaging; if it moves, we fall back to running the shim through a shell.
const resolveNativeCodex = (command: string, exists: (command: string) => boolean) => {
  if (win32.basename(command).toLowerCase() !== "codex.cmd") return null;

  const npmBinDir = win32.dirname(command);
  const candidates = [
    win32.join(
      npmBinDir,
      "node_modules",
      "@openai",
      "codex",
      "node_modules",
      "@openai",
      "codex-win32-x64",
      "vendor",
      "x86_64-pc-windows-msvc",
      "bin",
      "codex.exe",
    ),
    win32.join(npmBinDir, "node_modules", "@openai", "codex", "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe"),
  ];

  return candidates.find(exists) ?? null;
};

const isWindowsShim = (command: string) => {
  const lower = command.toLowerCase();
  return lower.endsWith(".cmd") || lower.endsWith(".bat");
};

// `Bun.which` can land on `codex.ps1` when PATHEXT lists `.PS1` before `.CMD`,
// and neither `spawn` nor `cmd.exe` can run a `.ps1`. npm always writes the
// sibling `.cmd`/`.exe` next to it, so switch to that.
const preferSpawnableSibling = (command: string, exists: (command: string) => boolean) => {
  if (!command.toLowerCase().endsWith(".ps1")) return command;

  const base = command.slice(0, -".ps1".length);
  for (const extension of [".cmd", ".bat", ".exe"]) {
    if (exists(base + extension)) return base + extension;
  }
  return command;
};

export const resolveCodexCommand = (
  input: {
    exists?: (command: string) => boolean;
    platform?: NodeJS.Platform | "win32";
    which?: (command: string) => string | null;
  } = {},
) => {
  const platform = input.platform ?? process.platform;
  const which = input.which ?? ((command: string) => (typeof Bun.which === "function" ? Bun.which(command) : null));
  const exists = input.exists ?? existsSync;
  const resolved = which("codex");

  if (platform === "win32" && resolved) {
    const target = preferSpawnableSibling(resolved, exists);
    return resolveNativeCodex(target, exists) ?? target;
  }

  return resolved ?? "codex";
};

const defaultSpawnProcess = (
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> },
): SpawnedChild => {
  const command = resolveCodexCommand();
  // `child_process.spawn` can't launch a `.cmd`/`.bat` directly on Windows;
  // fall back to a shell only when we couldn't resolve the native binary.
  const useShell = process.platform === "win32" && isWindowsShim(command);
  const child = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
    windowsHide: true,
    shell: useShell,
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
  // Keep diagnostics from filling the pipe and blocking the executable.
  child.stderr.resume();

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
    timeoutStrategy: "provider", // Process exit, not chat activity, owns completion.
    pid: child.pid,
  } satisfies HarnessSession;
};

export type ResumeSpawnInput = StartSpawnInput & {
  agentSessionId: string;
  messageOffset?: number;
};

export const resumeCodexSession = (input: ResumeSpawnInput, deps: SpawnDeps = defaultDeps) => {
  const child = deps.spawnProcess(buildResumeArgs(input), { cwd: input.cwd, env: input.env });
  child.stderr.resume();

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
    timeoutStrategy: "provider",
    pid: child.pid,
  } satisfies HarnessSession;
};
