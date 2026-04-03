import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type {
  ApprovalService,
  EventStore,
  RawLogEvent,
  SessionMessage,
  SessionMessageInput,
  SessionStartInput,
  SpawnedProcess,
} from "../../types";
import { normalizeClaudeCodeStream } from "./claude-code-normalizer";

// --- Env ---

const cleanEnv = () => {
  const { CLAUDECODE, ...rest } = process.env;
  return rest;
};

// --- CLI args ---

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

export const buildSpawnArgs = (input: SessionMessageInput) => {
  const args = ["--resume", input.sessionId, ...BASE_ARGS];

  if (input.model) {
    args.push("--model", input.model);
  }

  return args;
};

// --- User message formatting ---

const formatUserMessage = (content: string) =>
  `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`;

const sendUserMessage = (stdin: Writable, content: string, options?: { keepOpen?: boolean }) => {
  stdin.write(formatUserMessage(content));

  if (!options?.keepOpen) {
    stdin.end();
  }
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
  approvalService?: ApprovalService,
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

    if (parsed && isControlRequest(parsed) && approvalService) {
      const requestId = parsed.request_id as string;
      const request = parsed.request as Record<string, unknown>;
      const toolName = (request.tool_name as string) ?? "";
      const toolInput = request.input;
      const toolUseId = (request.tool_use_id as string) ?? "";

      const response = await approvalService.requestApproval({ id: requestId, toolName, toolInput, toolUseId });
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

// --- Message accumulator ---

type AccumulatorOptions = {
  initialMessages?: SessionMessage[];
  indexOffset?: number;
  pushInitialMessages?: boolean;
};

export const createMessageAccumulator = (eventStore: EventStore, options: AccumulatorOptions = {}) => {
  const messages: SessionMessage[] = [...(options.initialMessages ?? [])];
  const toolCalls = new Map<string, number>();
  const offset = options.indexOffset ?? 0;

  const toPath = (idx: number) => `/messages/${offset + idx}`;

  if (options.pushInitialMessages) {
    for (let i = 0; i < messages.length; i++) {
      eventStore.push({ op: "add", path: toPath(i), value: messages[i] });
    }
  }

  const push = (message: SessionMessage) => {
    const firstPart = message.parts[0];
    if (!firstPart) return;

    // Tool result replaces pending tool_use at same index
    if (firstPart.type === "tool" && firstPart.callId && firstPart.status !== "pending") {
      const existingIdx = toolCalls.get(firstPart.callId);

      if (existingIdx !== undefined) {
        messages[existingIdx] = message;
        eventStore.push({ op: "replace", path: toPath(existingIdx), value: message });
        return;
      }
    }

    // Track pending tool calls for later replacement
    if (firstPart.type === "tool" && firstPart.callId && firstPart.status === "pending") {
      toolCalls.set(firstPart.callId, messages.length);
    }

    // Accumulate consecutive text with same role
    const lastIdx = messages.length - 1;
    const lastMessage = messages[lastIdx];
    const lastPart = lastMessage?.parts[0];

    if (firstPart.type === "text" && lastPart?.type === "text" && message.role === lastMessage.role) {
      const updated = { ...lastMessage, parts: [{ ...lastPart, text: lastPart.text + firstPart.text }] };
      messages[lastIdx] = updated;
      eventStore.push({ op: "replace", path: toPath(lastIdx), value: updated });
      return;
    }

    // Accumulate consecutive reasoning with same role
    if (firstPart.type === "reasoning" && lastPart?.type === "reasoning" && message.role === lastMessage.role) {
      const updated = { ...lastMessage, parts: [{ ...lastPart, text: lastPart.text + firstPart.text }] };
      messages[lastIdx] = updated;
      eventStore.push({ op: "replace", path: toPath(lastIdx), value: updated });
      return;
    }

    // Default: append
    messages.push(message);
    eventStore.push({ op: "add", path: toPath(messages.length - 1), value: message });
  };

  return { push };
};

// --- Pipeline ---

const runPipelineFromEvents = async (
  events: AsyncIterable<RawLogEvent>,
  eventStore: EventStore,
  accumulatorOptions?: AccumulatorOptions,
) => {
  const accumulator = createMessageAccumulator(eventStore, accumulatorOptions);

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
  kill(): void;
  onExit: Promise<{ code: number | null; signal: string | null }>;
};

export type SpawnDeps = {
  spawnProcess: (args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }) => SpawnedChild;
};

const defaultSpawnProcess = (args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }): SpawnedChild => {
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
    kill: () => child.kill(),
    onExit,
  };
};

const defaultDeps: SpawnDeps = { spawnProcess: defaultSpawnProcess };

// --- Entry points ---

export const spawnClaudeCodeSession = async (input: SessionStartInput, deps: SpawnDeps = defaultDeps) => {
  const args = buildStartSessionArgs(input);
  const child = deps.spawnProcess(args, { cwd: input.cwd, env: input.env });

  sendUserMessage(child.stdin, input.prompt);

  const events = createRawEventStream(child.stdout, child.stdin);
  const { sessionId, remainingEvents } = await extractSessionId(events);

  if (!input.eventStore) {
    return { sessionId };
  }

  const userMessage: SessionMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    parts: [{ type: "text", text: input.prompt }],
  };

  const pipelineDone = runPipelineFromEvents(remainingEvents, input.eventStore, {
    initialMessages: [userMessage],
    pushInitialMessages: true,
  });

  const onExit = Promise.all([child.onExit, pipelineDone]).then(([exitResult]) => exitResult);

  return {
    sessionId,
    process: {
      sessionId,
      stdin: child.stdin,
      kill: child.kill,
      onExit,
    } satisfies SpawnedProcess,
  };
};

export const spawnClaudeCodeMessage = async (
  input: SessionMessageInput,
  eventStore: EventStore,
  approvalService?: ApprovalService,
  deps: SpawnDeps = defaultDeps,
) => {
  const args = buildSpawnArgs(input);
  const child = deps.spawnProcess(args, { cwd: input.cwd, env: input.env });

  // Claude resume can stall until it sees EOF from stdin in our spawned process.
  sendUserMessage(child.stdin, input.prompt);

  const userMessage: SessionMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    parts: [{ type: "text", text: input.prompt }],
  };

  const events = createRawEventStream(child.stdout, child.stdin, approvalService);

  const pipelineDone = runPipelineFromEvents(events, eventStore, {
    initialMessages: [userMessage],
    indexOffset: input.messageOffset ?? 0,
    pushInitialMessages: true,
  });

  const onExit = Promise.all([child.onExit, pipelineDone]).then(([exitResult]) => exitResult);

  return {
    sessionId: input.sessionId,
    stdin: child.stdin,
    kill: child.kill,
    onExit,
  } satisfies SpawnedProcess;
};
