import { expect, test } from "bun:test";
import { codexCommandState } from "./command-state";

const goal = {
  threadId: "one",
  createdAt: 1,
  updatedAt: 2,
  objective: "Ship the release",
  status: "paused" as const,
  tokensUsed: 42,
  tokenBudget: 1000,
  timeUsedSeconds: 4,
};
test("Codex declares tagged input and confirmed goal details with its native close action", () => {
  const state = codexCommandState({ params: {} }, goal);
  expect(state.commands.find((command) => command.name === "/goal")?.composer).toMatchObject({
    label: "Goal",
    modeId: "goal",
    reservedArguments: ["pause", "resume", "clear"],
  });
  expect(state.modes.find((mode) => mode.id === "goal")).toMatchObject({
    tagText: "paused: Ship the release",
    closeActionId: "clear",
  });
  expect(state.commands.find((command) => command.name === "/plan")?.disabledReason).toBeTruthy();
});
test("Codex reports planning selection separately and blocks an unverified goal combination", () => {
  const state = codexCommandState({ params: { collaboration_mode: "plan" } }, null);
  expect(state.modes[0]).toMatchObject({ id: "planning", label: "Plan", closeActionId: "default" });
  expect(state.commands.find((command) => command.name === "/goal")?.disabledReason).toBeTruthy();
});

test("Codex presents a native proposed plan as an explicit approval decision", () => {
  const state = codexCommandState({ params: { collaboration_mode: "plan" } }, null, {
    id: "turn/proposal",
    text: "Replace the duplicated controls.",
  });
  expect(state.modes[0]).toMatchObject({
    description: "Replace the duplicated controls.",
    state: "Awaiting approval",
    confirmation: { id: "turn/proposal", title: "Approve plan", actionId: "implement", cancelLabel: "Keep planning" },
    actions: expect.arrayContaining([{ id: "implement", label: "Approve and implement" }]),
  });
});
