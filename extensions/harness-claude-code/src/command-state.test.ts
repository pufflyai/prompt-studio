import { expect, test } from "bun:test";
import { claudeCommandState } from "./commands";

test("Claude declares draft input without claiming a readable native goal", () => {
  const state = claudeCommandState({ params: {} });
  expect(state.commands.find((command) => command.name === "/goal")?.composer).toMatchObject({ label: "Goal" });
  expect(state.commands.find((command) => command.name === "/goal")?.composer?.modeId).toBeUndefined();
  expect(state.modes).toEqual([]);
});
test("Claude declares the planning close action and its combination restriction", () => {
  const state = claudeCommandState({ params: { permission_mode: "plan" } });
  expect(state.modes[0]).toMatchObject({ label: "Plan", closeActionId: "default" });
  expect(state.commands.find((command) => command.name === "/goal")?.disabledReason).toBeTruthy();
});
