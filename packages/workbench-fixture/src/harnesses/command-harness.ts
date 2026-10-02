import type { HarnessProvider } from "@pstdio/sdk/extensions";
import { createFakeHarness } from "./fake-harness";

export const createCommandHarness = (modes: boolean) =>
  ({
    ...createFakeHarness(),
    id: modes ? "native-modes" : "native-action",
    label: modes ? "Native modes fixture" : "Native action fixture",
    params: {
      goal: { type: "boolean", label: "Goal", defaultValue: false },
      planning: { type: "boolean", label: "Planning", defaultValue: false },
    },
    getCommandState: (_ctx, input) => ({
      slashCommands: true,
      commands: [
        { name: "/goal", description: "Fixture native goal action" },
        { name: "/plan", description: "Fixture planning" },
      ],
      modes: modes
        ? [
            ...(input.params?.goal
              ? [
                  {
                    id: "goal",
                    label: "Goal",
                    description: "Native fixture objective",
                    state: "active",
                    actions: [{ id: "clear", label: "Clear goal" }],
                  },
                ]
              : []),
            ...(input.params?.planning
              ? [
                  {
                    id: "planning",
                    label: "Planning",
                    description: "Next turn selection",
                    state: "selected",
                    actions: [],
                  },
                ]
              : []),
          ]
        : [],
    }),
    prepareOperation: (_ctx, _input, operation) => {
      if (operation.kind === "mode-action")
        return { execution: "control", invoke: async () => ({ kind: "completed", params: { goal: false } }) };
      if (operation.text === "/fail")
        return {
          execution: "exclusive",
          invoke: async () => ({
            kind: "started",
            session: { done: Bun.sleep(200).then(() => ({ status: "failed" })), stop: () => {} },
          }),
        };
      if (!["/goal", "/plan"].includes(operation.text.trim())) throw new Error("Unsupported fixture command.");
      return {
        execution: "control",
        invoke: async () => ({
          kind: "completed",
          message: modes ? undefined : "Native action completed",
          params: modes ? { [operation.text.trim() === "/goal" ? "goal" : "planning"]: true } : undefined,
        }),
      };
    },
  }) satisfies Omit<HarnessProvider, "ref">;
