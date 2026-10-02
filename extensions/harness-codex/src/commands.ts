import type { HarnessCommandContext, HarnessOperation, PreparedHarnessOperation } from "@pstdio/sdk/extensions";
import type { createCodexRuntime } from "./codex-runtime";
import { codexCommandInput } from "./command-input";
import { prepareGoalOperation } from "./goal-commands";

export { codexCommandState } from "./command-state";

const prepareModeAction = (
  input: HarnessCommandContext,
  operation: Extract<HarnessOperation, { kind: "mode-action" }>,
  runtime: ReturnType<typeof createCodexRuntime>,
  projectId?: string,
): PreparedHarnessOperation => {
  if (operation.modeId === "planning" && operation.actionId === "default")
    return {
      execution: "control",
      invoke: async () => ({ kind: "completed", params: { collaboration_mode: "default" } }),
    };
  if (operation.modeId !== "goal" || !["pause", "resume", "clear", "edit"].includes(operation.actionId))
    throw new Error("Unknown Codex mode action.");
  if (operation.actionId !== "edit")
    return prepareGoalOperation(input, operation.actionId, `/goal ${operation.actionId}`, runtime, projectId);
  if (!input.agentSessionId || !operation.argument?.trim()) throw new Error("Enter a goal objective.");
  return {
    execution: "control",
    invoke: async ({ events }) => {
      await runtime
        .worker(codexCommandInput(input, events, projectId))
        .request("thread/goal/set", { threadId: input.agentSessionId, objective: operation.argument });
      return { kind: "completed" };
    },
  };
};
export const prepareCodexOperation = (
  input: HarnessCommandContext,
  operation: HarnessOperation,
  runtime: ReturnType<typeof createCodexRuntime>,
  projectId?: string,
): PreparedHarnessOperation => {
  if (operation.kind === "mode-action") return prepareModeAction(input, operation, runtime, projectId);
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(operation.text);
  const name = match?.[1];
  const argument = match?.[2] ?? "";
  if (name === "goal") return prepareGoalOperation(input, argument, operation.text, runtime, projectId);
  if (name === "plan") {
    if (!argument)
      return {
        execution: "control",
        invoke: async () => ({ kind: "completed", params: { collaboration_mode: "plan" } }),
      };
    return {
      execution: "exclusive",
      invoke: async ({ events, signal }) => ({
        kind: "started",
        params: { collaboration_mode: "plan" },
        session: await runtime.run({
          ...codexCommandInput(input, events, projectId, signal),
          prompt: argument,
          params: { ...input.params, collaboration_mode: "plan" },
        }),
      }),
    };
  }
  if (name !== "compact") throw new Error(`Codex does not support ${operation.text.split(/\s/)[0]}.`);
  if (argument) throw new Error("Codex /compact does not accept arguments.");
  if (!input.agentSessionId) throw new Error("Send a message before compacting this conversation.");
  return {
    execution: "exclusive",
    invoke: async ({ events, signal }) => ({
      kind: "started",
      session: await runtime.run(
        { ...codexCommandInput(input, events, projectId, signal), prompt: operation.text },
        { method: "thread/compact/start", params: {} },
      ),
    }),
  };
};
