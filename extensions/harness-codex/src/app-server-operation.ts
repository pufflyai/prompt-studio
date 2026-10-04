import type { HarnessExit } from "@pstdio/sdk/extensions";
import { createAppServerItems } from "./app-server-items";
import type { RpcMessage } from "./app-server-rpc";
import { errorMessage, itemToMessage, usageMessage } from "./items";
import { createNativeProjection } from "./native-history";
import type { ThreadItem } from "./protocol/v2/ThreadItem";
import { confirmQuestionReply } from "./question-confirmation";
import { createQuestionChannel } from "./questions";
import { type ResumeSpawnInput, type StartSpawnInput, userMessageFor } from "./session-input";

export interface NativeOperation {
  method: string;
  params: Record<string, unknown>;
  goal?: boolean;
}
export const createAppServerOperation = (
  input: StartSpawnInput & Partial<ResumeSpawnInput>,
  options: {
    command?: NativeOperation;
    transcriptPath: () => string | null;
    write: (message: RpcMessage) => void;
    onFinish: () => void;
    onProtocolError: (error: unknown) => void;
  },
) => {
  const completion = Promise.withResolvers<HarnessExit>();
  const projection = createNativeProjection(
    input.events,
    options.command ? undefined : userMessageFor(input.prompt, input.attachments),
    input.messageOffset,
  );
  if (options.command) projection.publish(userMessageFor(input.prompt));
  let turnId: string | undefined;
  let goalActive = Boolean(options.command?.goal);
  let ownsGoal = goalActive;
  let sent = false;
  let acknowledged = false;
  let finished = false;
  let stopping = false;
  let goalUpdates = 0;
  let idleExit: HarnessExit | undefined;
  const earlyEvents: RpcMessage[] = [];
  const publish = (item: import("./types").CodexThreadItem) => {
    const message = itemToMessage(item, `codex-${item.turnId ?? turnId}`);
    if (message) projection.publish(message);
  };
  const items = createAppServerItems(publish);
  const questions = createQuestionChannel(options.write, publish, (callId, answers, signal) =>
    confirmQuestionReply(options.transcriptPath(), callId, answers, signal),
  );
  const finish = (exit: HarnessExit) => {
    if (finished) return;
    finished = true;
    options.onFinish();
    void questions.close().finally(() => completion.resolve(exit));
  };
  const finishIfIdle = () => {
    if (!turnId && !goalActive && !goalUpdates && (ownsGoal || idleExit))
      finish(stopping ? { status: "cancelled" } : (idleExit ?? { status: "completed" }));
  };
  const applyGoal = (status: string | undefined) => {
    goalActive = status === "active";
    if (goalActive) ownsGoal = true;
    finishIfIdle();
  };
  const goalEvent = (message: RpcMessage) => {
    if (message.method === "thread/goal/updated") applyGoal((message.params?.goal as { status: string }).status);
    if (message.method === "thread/goal/cleared") applyGoal(undefined);
  };
  const completeTurn = (turn: { id: string; status: string; error?: { message?: string } }) => {
    if (turnId !== turn.id) return;
    if (turn.status === "failed")
      projection.publish(errorMessage(turn.error?.message, `codex-${turn.id}-error`, Date.now()));
    else projection.publish(usageMessage(items.getUsage(), `codex-${turn.id}-usage`, Date.now()));
    if (turn.status === "completed" && options.command?.method === "thread/compact/start")
      projection.publish({
        id: `codex-${turn.id}-compaction`,
        role: "system",
        parts: [{ type: "text", text: "Native context compaction completed." }],
      });
    const statuses = { interrupted: "cancelled", completed: "completed" } as const;
    const status = statuses[turn.status as keyof typeof statuses] ?? "failed";
    if (status !== "completed" || (!goalActive && !goalUpdates)) finish({ status });
    else {
      turnId = undefined;
      idleExit = { status };
      finishIfIdle();
    }
  };
  const receiveItems = (message: RpcMessage) => {
    const params = message.params ?? {};
    const item = params.item as ThreadItem | undefined;
    const itemEvent = message.method === "item/started" || message.method === "item/completed";
    if (itemEvent && item?.type === "userMessage") projection.receive(item, String(params.turnId));
    if (message.method === "item/completed" && item?.type === "contextCompaction")
      projection.receive(item, String(params.turnId));
    items.receive(message);
    questions.receive(message);
  };
  const receiveNotification = (message: RpcMessage) => {
    if (finished || !sent) return;
    if (!acknowledged) {
      earlyEvents.push(message);
      return;
    }
    goalEvent(message);
    if (finished) return;
    const params = message.params ?? {};
    const turn = params.turn as { id: string; status: string; error?: { message?: string } } | undefined;
    if (message.method === "turn/started" && turn && !turnId) {
      turnId = turn.id;
      idleExit = undefined;
    }
    if (!turnId) return;
    if (params.turnId && params.turnId !== turnId) return;
    if (message.method === "turn/completed" && turn) {
      completeTurn(turn);
      return;
    }
    receiveItems(message);
  };
  const receive = (message: RpcMessage) => {
    try {
      receiveNotification(message);
    } catch (error) {
      options.onProtocolError(error);
    }
  };
  return {
    done: completion.promise,
    fail: (error: unknown) => {
      projection.publish(
        errorMessage(
          error instanceof Error ? error.message : String(error),
          `codex-${turnId ?? crypto.randomUUID()}-error`,
          Date.now(),
        ),
      );
    },
    finish,
    receive,
    replyQuestion: questions.replyQuestion,
    canUpdateGoal: () => sent && acknowledged && !finished && !stopping,
    startDelivery: () => {
      sent = true;
    },
    acknowledge: (id?: string) => {
      turnId = id ?? turnId;
      acknowledged = true;
      for (const message of earlyEvents) receive(message);
      earlyEvents.length = 0;
    },
    setGoal: (active: boolean) => {
      goalActive = active;
      ownsGoal = active;
    },
    beginGoalUpdate: () => {
      if (finished) throw new Error("Current work finished. Send the goal again.");
      // A goal mutation can outlive the current turn. Keep its existing owner until the native outcome arrives.
      goalUpdates++;
      let released = false;
      return {
        confirm: (status: string) => {
          applyGoal(status);
        },
        release: () => {
          if (released) return;
          released = true;
          goalUpdates--;
          finishIfIdle();
        },
      };
    },
    recordGoalUpdate: (prompt: string) => projection.publish(userMessageFor(prompt)),
    stop: async (request: (method: string, params: Record<string, unknown>) => Promise<unknown>, threadId: string) => {
      if (finished) return;
      stopping = true;
      if (goalActive) await request("thread/goal/set", { threadId, status: "paused" });
      if (turnId) await request("turn/interrupt", { threadId, turnId });
      else finish({ status: "cancelled" });
    },
  };
};
