import type { HarnessCommandContext, HarnessEventSink, PreparedHarnessOperation } from "@pstdio/sdk/extensions";
import type { createCodexRuntime } from "./codex-runtime";
import { codexCommandIdentity, codexCommandInput } from "./command-input";
import type { ThreadGoal } from "./protocol/v2/ThreadGoal";
export const prepareGoalOperation = (
  input: HarnessCommandContext,
  argument: string,
  text: string,
  runtime: ReturnType<typeof createCodexRuntime>,
  projectId?: string,
): PreparedHarnessOperation => {
  const worker = (events: HarnessEventSink) => runtime.worker(codexCommandInput(input, events, projectId));
  if (!argument)
    return {
      execution: "control",
      invoke: async ({ events }) => {
        if (!input.agentSessionId) return { kind: "completed", message: "No native goal. Use /goal <objective>." };
        const { goal } = (await worker(events).request("thread/goal/get", { threadId: input.agentSessionId })) as {
          goal: ThreadGoal | null;
        };
        return {
          kind: "completed",
          message: goal ? `${goal.objective} (${goal.status})` : "No native goal. Use /goal <objective>.",
        };
      },
    };
  if (argument === "pause" || argument === "clear") {
    if (!input.agentSessionId) throw new Error("There is no native goal to change.");
    return {
      execution: "control",
      invoke: async ({ events }) => {
        await worker(events).request(argument === "clear" ? "thread/goal/clear" : "thread/goal/set", {
          threadId: input.agentSessionId,
          ...(argument === "pause" ? { status: "paused" } : {}),
        });
        return { kind: "completed" };
      },
    };
  }
  const update = runtime.prepareGoalUpdate(codexCommandIdentity(input, projectId));
  const params = argument === "resume" ? { status: "active" } : { objective: argument, status: "active" };
  if (update)
    return {
      execution: "control",
      invoke: async ({ signal }) => {
        await update(params, signal, text);
        return { kind: "completed" };
      },
    };
  return {
    execution: "exclusive",
    invoke: async ({ events, signal }) => ({
      kind: "started",
      session: await runtime.run(
        { ...codexCommandInput(input, events, projectId, signal), prompt: text },
        {
          method: "thread/goal/set",
          params,
          goal: true,
        },
      ),
    }),
  };
};
