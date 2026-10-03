import type { HarnessCommandDiscoveryContext, HarnessCommandState } from "@pstdio/sdk/extensions";
import type { ThreadGoal } from "./protocol/v2/ThreadGoal";

export const codexCommandState = (
  input: HarnessCommandDiscoveryContext,
  goal: ThreadGoal | null,
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
            description: "Codex planning is selected for the next turn.",
            state: "Next turn",
            closeActionId: "default",
            actions: [{ id: "default", label: "Leave planning" }],
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
