import type {
  HarnessAttachment,
  HarnessEventSink,
  HarnessExit,
  HarnessSession,
  QuestionResponse,
} from "@pstdio/sdk/extensions";
import { createAppServerItems } from "./app-server-items";
import { createAppServerRpc } from "./app-server-rpc";
import { defaultSpawnProcess, type SpawnDeps } from "./codex-process";
import { createCodexStreamPipeline } from "./normalize-stream";
import { confirmQuestionReply } from "./question-confirmation";
import { createQuestionChannel, questionReplyError } from "./questions";
import { promptWithAttachmentManifest, userMessageFor } from "./session-input";
import type { CodexThreadEvent } from "./types";

export type { SpawnDeps } from "./codex-process";
export interface StartSpawnInput {
  prompt: string;
  attachments?: HarnessAttachment[];
  model?: string | null;
  params?: { model_reasoning_effort?: string | boolean };
  cwd?: string;
  env?: Record<string, string>;
  events: HarnessEventSink;
}
export interface ResumeSpawnInput extends StartSpawnInput {
  agentSessionId: string;
  messageOffset?: number;
  questionResponse?: QuestionResponse;
}

const runCodexSession = async (input: StartSpawnInput & Partial<ResumeSpawnInput>, deps: SpawnDeps) => {
  if (input.questionResponse) throw questionReplyError("Codex question request is no longer pending.");
  const child = deps.spawnProcess(
    ["app-server", "--listen", "stdio://", "--enable", "default_mode_request_user_input"],
    { cwd: input.cwd, env: input.env },
  );
  const pipeline = createCodexStreamPipeline(input.events, {
    initialMessages: [userMessageFor(input.prompt, input.attachments)],
    indexOffset: input.messageOffset ?? 0,
  });
  const publish = (item: import("./types").CodexThreadItem) => pipeline.handleEvent({ type: "item.updated", item });
  const items = createAppServerItems(publish);
  const completion = Promise.withResolvers<HarnessExit>();
  let ended = false;
  let transcriptPath: string | null = null;
  const finish = (exit: HarnessExit, event?: CodexThreadEvent) => {
    if (ended) return;
    ended = true;
    void questions.close().finally(() => {
      if (event) pipeline.handleEvent(event);
      completion.resolve(exit);
      child.kill();
    });
  };
  const rpc = createAppServerRpc(child, (message) => {
    if (ended) return;
    items.receive(message);
    questions.receive(message);
    if (message.method === "turn/completed") {
      const turn = message.params?.turn as { status: string; error?: { message?: string } };
      const statuses: Record<string, HarnessExit["status"]> = {
        completed: "completed",
        interrupted: "cancelled",
        failed: "failed",
      };
      finish(
        { status: statuses[turn.status] ?? "failed" },
        turn.status === "failed"
          ? { type: "turn.failed", error: turn.error }
          : { type: "turn.completed", usage: items.getUsage() },
      );
    }
  });
  const questions = createQuestionChannel(rpc.write, publish, (callId, answers, signal) =>
    confirmQuestionReply(transcriptPath, callId, answers, signal),
  );
  child.onExit.then((exit) =>
    finish({ status: exit.signal === "SIGTERM" || exit.signal === "SIGINT" ? "cancelled" : "failed" }),
  );
  rpc.finished.then(
    () => finish({ status: "failed" }),
    () => finish({ status: "failed" }),
  );
  try {
    await rpc.request("initialize", {
      clientInfo: { name: "pstdio", version: "1" },
      capabilities: { experimentalApi: true },
    });
    rpc.write({ method: "initialized" });
    const result = (await rpc.request(input.agentSessionId ? "thread/resume" : "thread/start", {
      ...(input.agentSessionId ? { threadId: input.agentSessionId } : {}),
      ...(input.model ? { model: input.model } : {}),
      cwd: input.cwd,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      config: { model_reasoning_effort: input.params?.model_reasoning_effort ?? "medium" },
    })) as { thread: { id: string; path: string | null } };
    transcriptPath = result.thread.path;
    await rpc.request("turn/start", {
      threadId: result.thread.id,
      input: [{ type: "text", text: promptWithAttachmentManifest(input.prompt, input.attachments), text_elements: [] }],
    });
    return {
      agentSessionId: result.thread.id,
      done: Promise.all([completion.promise, child.onExit, rpc.finished.catch(() => {})]).then(([exit]) => exit),
      stop: () => finish({ status: "cancelled" }),
      replyQuestion: questions.replyQuestion,
      timeoutStrategy: "provider",
      pid: child.pid,
    } satisfies HarnessSession;
  } catch (error) {
    finish({ status: "failed" });
    throw error;
  }
};

export const startCodexSession = (input: StartSpawnInput, deps: SpawnDeps = { spawnProcess: defaultSpawnProcess }) =>
  runCodexSession(input, deps);
export const resumeCodexSession = (input: ResumeSpawnInput, deps: SpawnDeps = { spawnProcess: defaultSpawnProcess }) =>
  runCodexSession(input, deps);
