import type { HarnessCommandContext, HarnessCommandState } from "@pstdio/sdk/extensions";
import type { ThreadGoal } from "./protocol/v2/ThreadGoal";

export const codexCommandState = (input: HarnessCommandContext, goal: ThreadGoal | null): HarnessCommandState => ({
  slashCommands: true,
  commands: [
    {
      name: "/goal",
      description: "Work toward a native Codex objective.",
      argumentHelp: "<objective> | pause | resume | clear",
    },
    { name: "/plan", description: "Select Codex planning for the next turn.", argumentHelp: "[task]" },
    { name: "/compact", description: "Compact the current native thread." },
  ],
  modes: [
    ...(input.params?.collaboration_mode === "plan"
      ? [
          {
            id: "planning",
            label: "Planning",
            description: "Codex planning is selected for the next turn.",
            state: "Next turn",
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
            state: `${goal.status} · ${goal.tokensUsed}${goal.tokenBudget ? ` / ${goal.tokenBudget}` : ""} tokens`,
            actions: [
              ...(goal.status === "active" ? [{ id: "pause", label: "Pause" }] : [{ id: "resume", label: "Resume" }]),
              { id: "edit", label: "Edit", argument: { label: "Objective", value: goal.objective } },
              { id: "clear", label: "Clear" },
            ],
          },
        ]
      : []),
  ],
});
