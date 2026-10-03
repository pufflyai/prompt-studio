import type { HarnessCommandDiscoveryContext, HarnessCommandState } from "@pstdio/sdk/extensions";
import type { ThreadGoal } from "./protocol/v2/ThreadGoal";

export const codexCommandState = (
  input: HarnessCommandDiscoveryContext,
  goal: ThreadGoal | null,
  plan?: { id: string; text: string },
): HarnessCommandState => ({
  slashCommands: true,
  commands: [
    {
      name: "/goal",
      description: "Work toward a native Codex objective.",
      argumentHelp: "<objective> | pause | resume | clear",
      composer: { label: "Goal", modeId: "goal", reservedArguments: ["pause", "resume", "clear"] },
      ...(input.params?.collaboration_mode === "plan"
        ? { disabledReason: "Leave planning before setting a goal. This combination is not verified." }
        : {}),
    },
    {
      name: "/plan",
      description: "Select Codex planning for the next turn.",
      argumentHelp: "[task]",
      composer: { label: "Plan", modeId: "planning" },
      ...(goal
        ? { disabledReason: "Clear the goal before selecting planning. This combination is not verified." }
        : {}),
    },
    { name: "/compact", description: "Compact the current native thread." },
  ],
  modes: [
    ...(input.params?.collaboration_mode === "plan"
      ? [
          {
            id: "planning",
            label: "Plan",
            description: plan?.text ?? "Codex planning is selected for the next turn.",
            state: plan ? "Awaiting approval" : "Next turn",
            closeActionId: "default",
            ...(plan && !goal
              ? {
                  confirmation: {
                    id: plan.id,
                    title: "Approve plan",
                    actionId: "implement",
                    cancelLabel: "Keep planning",
                  },
                }
              : {}),
            actions: [
              ...(plan && !goal ? [{ id: "implement", label: "Approve and implement" }] : []),
              { id: "default", label: "Leave planning" },
            ],
          },
        ]
      : []),
    ...(goal
      ? [
          {
            id: "goal",
            label: "Goal",
            description: goal.objective,
            state: `${goal.status} · ${goal.tokensUsed}${goal.tokenBudget ? ` / ${goal.tokenBudget}` : ""} tokens · ${goal.timeUsedSeconds}s`,
            tagText: `${goal.status}: ${goal.objective}`,
            closeActionId: "clear",
            actions: [
              ...(goal.status === "active" ? [{ id: "pause", label: "Pause" }] : [{ id: "resume", label: "Resume" }]),
              { id: "edit", label: "Edit", argument: { label: "Objective", value: goal.objective } },
              { id: "clear", label: "Clear current goal" },
            ],
          },
        ]
      : []),
  ],
});
