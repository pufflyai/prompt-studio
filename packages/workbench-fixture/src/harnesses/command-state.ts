import type { HarnessCommandDiscoveryContext, HarnessContext } from "@pstdio/sdk/extensions";

const planningMode = (plan?: { id: string; text: string }) => ({
  id: "planning",
  label: "Plan",
  description: plan?.text ?? "Next turn selection",
  state: plan ? "Awaiting approval" : "selected",
  ...(plan
    ? { confirmation: { id: plan.id, title: "Approve plan", actionId: "implement", cancelLabel: "Keep planning" } }
    : {}),
  closeActionId: "leave",
  actions: [
    ...(plan ? [{ id: "implement", label: "Approve and implement" }] : []),
    { id: "leave", label: "Leave planning" },
  ],
});

const goalMode = (goal: string) => ({
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
});

export const fixtureCommandState = async (
  ctx: HarnessContext,
  input: HarnessCommandDiscoveryContext,
  modes: boolean,
) => {
  const goal = input.sessionId ? await ctx.state.get<string>(`goal:${input.sessionId}`) : undefined;
  const plan = input.sessionId
    ? await ctx.state.get<{ id: string; text: string }>(`plan:${input.sessionId}`)
    : undefined;
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
    modes: modes ? [...(goal ? [goalMode(goal)] : []), ...(input.params?.planning ? [planningMode(plan)] : [])] : [],
  };
};
