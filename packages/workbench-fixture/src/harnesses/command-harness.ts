import type { HarnessParams, HarnessProvider } from "@pstdio/sdk/extensions";
import { createFakeHarness } from "./fake-harness";

export const createCommandHarness = (modes: boolean) =>
  ({
    ...createFakeHarness(),
    id: modes ? "native-modes" : "native-action",
    label: modes ? "Native modes fixture" : "Native action fixture",
    params: {
      planning: { type: "boolean", label: "Planning", defaultValue: false, control: "command" },
    },
    getCommandState: async (ctx, input) => {
      const goal = input.sessionId ? await ctx.state.get<string>(`goal:${input.sessionId}`) : undefined;
      return {
        slashCommands: true,
        commands: [
          {
            name: "/goal",
            description: "Fixture native goal action",
            composer: { label: "Goal", ...(modes ? { modeId: "goal" } : {}) },
          },
          {
            name: "/plan",
            description: "Fixture planning",
            composer: { label: "Plan", ...(modes ? { modeId: "planning" } : {}) },
          },
        ],
        modes: modes
          ? [
              ...(goal
                ? [
                    {
                      id: "goal",
                      label: "Goal",
                      description: goal,
                      state: "active",
                      tagText: `active: ${goal}`,
                      closeActionId: "clear",
                      actions: [
                        { id: "clear", label: "Clear goal" },
                        { id: "edit", label: "Edit", argument: { label: "Objective", value: goal } },
                      ],
                    },
                  ]
                : []),
              ...(input.params?.planning
                ? [
                    {
                      id: "planning",
                      label: "Plan",
                      description: "Next turn selection",
                      state: "selected",
                      closeActionId: "leave",
                      actions: [{ id: "leave", label: "Leave planning" }],
                    },
                  ]
                : []),
            ]
          : [],
      };
    },
    prepareOperation: (ctx, input, operation) => {
      if (operation.kind === "mode-action") {
        return {
          execution: "control",
          invoke: async () => {
            if (operation.modeId === "planning") return { kind: "completed", params: { planning: false } };
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
          return { kind: "completed", message: modes ? undefined : "Native action completed", params };
        },
      };
    },
  }) satisfies Omit<HarnessProvider, "ref">;
