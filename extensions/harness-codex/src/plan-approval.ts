import type { HarnessCommandContext, HarnessContext } from "@pstdio/sdk/extensions";
import type { createCodexRuntime } from "./codex-runtime";
import { codexCommandInput } from "./command-input";
import type { Turn } from "./protocol/v2/Turn";

export const approvedPlanKey = (threadId: string) => `approved-plan:${threadId}`;

export const codexProposedPlan = (turns: Turn[]) => {
  if (turns.some((turn) => turn.status === "inProgress")) return undefined;
  for (const turn of [...turns].reverse()) {
    if (turn.status !== "completed") continue;
    const item = [...turn.items].reverse().find((item) => item.type === "plan" && item.text.trim());
    if (item?.type === "plan") return { id: `${turn.id}/${item.id}`, text: item.text };
  }
  return undefined;
};

export const readCodexProposedPlan = async (
  request: (method: string, params: Record<string, unknown>) => Promise<unknown>,
  threadId: string,
  approvedId?: string,
) => {
  const result = (await request("thread/read", { threadId, includeTurns: true })) as { thread: { turns: Turn[] } };
  const plan = codexProposedPlan(result.thread.turns);
  return plan?.id === approvedId ? undefined : plan;
};

export const prepareCodexPlanApproval = (
  input: HarnessCommandContext,
  revision: string | undefined,
  runtime: ReturnType<typeof createCodexRuntime>,
  ctx: Pick<HarnessContext, "state" | "projectId">,
) => {
  if (!input.agentSessionId || input.params?.collaboration_mode !== "plan")
    throw new Error("There is no plan awaiting approval.");
  const threadId = input.agentSessionId;
  return {
    execution: "exclusive" as const,
    invoke: async (invocation: { events: Parameters<typeof codexCommandInput>[1]; signal?: AbortSignal }) => {
      const run = codexCommandInput(input, invocation.events, ctx.projectId, invocation.signal);
      const worker = runtime.worker(run);
      const request = (method: string, params: Record<string, unknown>) =>
        worker.request(method, params, invocation.signal);
      const approvedId = await ctx.state.get<string>(approvedPlanKey(threadId));
      const [plan, goal] = await Promise.all([
        readCodexProposedPlan(request, threadId, approvedId),
        request("thread/goal/get", { threadId }) as Promise<{ goal: unknown }>,
      ]);
      invocation.signal?.throwIfAborted();
      if (!plan || plan.id !== revision) throw new Error("The plan changed. Review the current plan before approving.");
      if (goal.goal) throw new Error("Clear the goal before implementing this plan. This combination is not verified.");
      const params = { collaboration_mode: "default" };
      // Native history keeps proposals, but does not record the person's approval decision.
      await ctx.state.set(approvedPlanKey(threadId), plan.id);
      try {
        const session = await runtime.run({
          ...run,
          prompt: "Implement the approved plan.",
          params: { ...input.params, ...params },
        });
        return { kind: "started" as const, params, session };
      } catch (error) {
        if (approvedId === undefined) await ctx.state.delete(approvedPlanKey(threadId));
        else await ctx.state.set(approvedPlanKey(threadId), approvedId);
        throw error;
      }
    },
  };
};
