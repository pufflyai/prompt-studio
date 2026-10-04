import type { HarnessParams, HarnessProvider } from "@pstdio/sdk/extensions";
import { fixtureCommandState } from "./command-state";
import { createFakeHarness } from "./fake-harness";

export const createCommandHarness = (modes: boolean) =>
  ({
    ...createFakeHarness(),
    id: modes ? "native-modes" : "native-action",
    label: modes ? "Native modes fixture" : "Native action fixture",
    params: {
      planning: { type: "boolean", label: "Planning", defaultValue: false, control: "command" },
    },
    getCommandState: (ctx, input) => fixtureCommandState(ctx, input, modes),
    prepareOperation: (ctx, input, operation) => {
      if (operation.kind === "mode-action") {
        if (operation.modeId === "planning" && operation.actionId === "implement")
          return {
            execution: "exclusive",
            invoke: async ({ events }) => {
              const plan = await ctx.state.get<{ id: string }>(`plan:${input.sessionId}`);
              if (!plan || plan.id !== operation.argument)
                throw new Error("The plan changed. Review the current plan before approving.");
              await ctx.state.delete(`plan:${input.sessionId}`);
              return {
                kind: "started",
                params: { planning: false },
                session: await createFakeHarness().resume(ctx, {
                  ...input,
                  agentSessionId: input.agentSessionId ?? "fixture",
                  prompt: "Implement the approved plan.",
                  params: { ...input.params, planning: false },
                  events,
                }),
              };
            },
          };
        return {
          execution: "control",
          invoke: async () => {
            if (operation.modeId === "planning") {
              await ctx.state.delete(`plan:${input.sessionId}`);
              return { kind: "completed", params: { planning: false } };
            }
            if (operation.actionId === "edit") await ctx.state.set(`goal:${input.sessionId}`, operation.argument ?? "");
            else await ctx.state.delete(`goal:${input.sessionId}`);
            return { kind: "completed" };
          },
        };
      }
      if (operation.text === "/fail")
        return {
          execution: "exclusive",
          invoke: async () => ({
            kind: "started",
            session: { done: Bun.sleep(200).then(() => ({ status: "failed" })), stop: () => {} },
          }),
        };
      const command = /^\/(goal|plan)(?:\s+([\s\S]*))?$/.exec(operation.text.trim());
      if (!command) throw new Error("Unsupported fixture command.");
      let params: HarnessParams | undefined;
      if (modes && command[1] === "plan") params = { planning: true };
      return {
        execution: "control",
        invoke: async () => {
          if (modes && command[1] === "goal")
            await ctx.state.set(`goal:${input.sessionId}`, command[2] ?? "Native fixture objective");
          if (modes && command[1] === "plan" && command[2])
            await ctx.state.set(`plan:${input.sessionId}`, { id: crypto.randomUUID(), text: command[2] });
          return { kind: "completed", message: modes ? undefined : "Native action completed", params };
        },
      };
    },
  }) satisfies Omit<HarnessProvider, "ref">;
