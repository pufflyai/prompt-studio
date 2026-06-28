import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type {
  HarnessApprovalChannel,
  HarnessAttachment,
  HarnessEventSink,
  HarnessExit,
  HarnessSession,
  SessionMessage,
} from "@pstdio/sdk/extensions";
import { createMessageAccumulator } from "./message-accumulator";
import { normalizeClaudeCodeStream } from "./normalize-stream";
import type { RawLogEvent } from "./types";

// Strip the nested-session marker so spawned agents do not detect a parent Claude session.
const cleanEnv = () => {
  const { CLAUDECODE, ...rest } = process.env;
  return rest;
};

const BASE_ARGS = [
  "--output-format",
  "stream-json",
  "--input-format",
  "stream-json",
  "--verbose",
  "--permission-prompt-tool",
  "stdio",
  "--permission-mode",
  "bypassPermissions",
  "--disallowedTools",
  "AskUserQuestion",
];

export const buildStartSessionArgs = (input: { model?: string | null }) => {
  const args = [...BASE_ARGS];

  if (input.model) {
    args.push("--model", input.model);
  }

  return args;
};

export const buildResumeArgs = (input: { agentSessionId: string; model?: string | null }) => {
  const args = ["--resume", input.agentSessionId, ...BASE_ARGS];

  if (input.model) {
    args.push("--model", input.model);
  }

  return args;
};

const formatUserMessage = (content: string) =>
  `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`;

// Claude can stall until it sees EOF from stdin in our spawned process.
const sendUserMessage = (stdin: Writable, content: string) => {
  stdin.write(formatUserMessage(content));
  stdin.end();
};

const promptWithAttachmentManifest = (prompt: string, attachments: HarnessAttachment[] = []) => {
  if (attachments.length === 0) return prompt;

  return [
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
  ].join("\n");
};

// --- Control protocol ---

const isControlRequest = (parsed: Record<string, unknown>) => parsed.type === "control_request";

const buildControlResponse = (requestId: string, decision: "approve" | "deny" | "timeout", input: unknown) => {
  if (decision === "approve") {
    return {
      type: "control_response",
      response: {
        subtype: "success",
        request_id: requestId,
        response: { behavior: "allow", updated_input: input, updated_permissions: null },
      },
    };
  }

  return {
    type: "control_response",
    response: {
      subtype: "success",
      request_id: requestId,
      response: {
        behavior: "deny",
        message:
          decision === "timeout"
            ? "Approval timed out."
            : "The user doesn't want to proceed with this tool use. The tool use was rejected.",
        interrupt: decision === "timeout",
      },
    },
  };
};

// --- Raw event stream ---

async function* createRawEventStream(
  stdout: Readable,
  stdin: Writable,
  approvals?: HarnessApprovalChannel,
): AsyncGenerator<RawLogEvent> {
  const reader = createInterface({ input: stdout, crlfDelay: Number.POSITIVE_INFINITY });

  for await (const line of reader) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: Record<string, unknown> | null = null;

    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      // not JSON
    }

    if (parsed && isControlRequest(parsed) && approvals) {
      const requestId = parsed.request_id as string;
      const request = parsed.request as Record<string, unknown>;
      const toolName = (request.tool_name as string) ?? "";
      const toolInput = request.input;
      const toolUseId = (request.tool_use_id as string) ?? "";

      const response = await approvals.requestApproval({ id: requestId, toolName, toolInput, toolUseId });
      const controlResponse = buildControlResponse(requestId, response.decision, toolInput);

      stdin.write(`${JSON.stringify(controlResponse)}\n`);
      continue;
    }

    if (parsed && parsed.type === "system" && typeof parsed.session_id === "string") {
      yield { type: "session_id", sessionId: parsed.session_id };
      continue;
    }

    yield { type: "stdout", data: trimmed };
  }
}

const runPipelineFromEvents = async (
  events: AsyncIterable<RawLogEvent>,
  sink: HarnessEventSink,
  accumulatorOptions: Parameters<typeof createMessageAccumulator>[1],
) => {
  const accumulator = createMessageAccumulator(sink, accumulatorOptions);

  for await (const message of normalizeClaudeCodeStream(events)) {
    accumulator.push(message);
  }
};

// --- Session ID extraction ---

const extractSessionId = async (events: AsyncGenerator<RawLogEvent>) => {
  const buffered: RawLogEvent[] = [];

  // Use manual .next() to avoid auto-closing the generator on early return
  while (true) {
    const { value, done } = await events.next();
    if (done) break;

    if (value.type === "session_id") {
      const sessionId = value.sessionId;

      async function* remainingEvents() {
        for (const event of buffered) {
          yield event;
        }
        yield* events;
      }

      return { sessionId, remainingEvents: remainingEvents() };
    }

    buffered.push(value);
  }

  throw new Error("Claude Code stream ended without providing session_id");
};

// --- Spawn process ---

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
  const child = spawn("claude", args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: options?.cwd,
    env: { ...cleanEnv(), ...options?.env },
  }) as ChildProcess;

  child.on("error", (err) => {
    console.error(`[claude-code:spawn] child process error:`, err);
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

// --- Entry points ---

export type StartSpawnInput = {
  prompt: string;
  attachments?: HarnessAttachment[];
  model?: string | null;
  cwd?: string;
  env?: Record<string, string>;
  events: HarnessEventSink;
};

export const startClaudeCodeSession = async (input: StartSpawnInput, deps: SpawnDeps = defaultDeps) => {
  const args = buildStartSessionArgs(input);
  const child = deps.spawnProcess(args, { cwd: input.cwd, env: input.env });

  sendUserMessage(child.stdin, promptWithAttachmentManifest(input.prompt, input.attachments));

  const events = createRawEventStream(child.stdout, child.stdin);
  const { sessionId, remainingEvents } = await extractSessionId(events);

  const pipelineDone = runPipelineFromEvents(remainingEvents, input.events, {
    initialMessages: [userMessageFor(input.prompt, input.attachments)],
    pushInitialMessages: true,
  });

  const done = Promise.all([child.onExit, pipelineDone]).then(([exit]) => toHarnessExit(exit));

  return {
    agentSessionId: sessionId,
    done,
    stop: child.kill,
    timeoutStrategy: "activity",
    pid: child.pid,
  } satisfies HarnessSession;
};

export type ResumeSpawnInput = StartSpawnInput & {
  agentSessionId: string;
  messageOffset?: number;
  approvals?: HarnessApprovalChannel;
};

export const resumeClaudeCodeSession = (input: ResumeSpawnInput, deps: SpawnDeps = defaultDeps) => {
  const args = buildResumeArgs(input);
  const child = deps.spawnProcess(args, { cwd: input.cwd, env: input.env });

  sendUserMessage(child.stdin, promptWithAttachmentManifest(input.prompt, input.attachments));

  const events = createRawEventStream(child.stdout, child.stdin, input.approvals);

  const pipelineDone = runPipelineFromEvents(events, input.events, {
    initialMessages: [userMessageFor(input.prompt, input.attachments)],
    indexOffset: input.messageOffset ?? 0,
    pushInitialMessages: true,
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
