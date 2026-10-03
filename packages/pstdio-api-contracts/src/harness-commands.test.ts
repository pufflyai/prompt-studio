import { expect, test } from "bun:test";
import { harnessCommandStateSchema } from "./harness-commands";

test("preserves harness-owned tagged input and native tag actions", () => {
  const state = {
    slashCommands: true,
    commands: [
      {
        name: "/objective",
        description: "Set an objective.",
        composer: { label: "Objective", modeId: "objective", reservedArguments: ["clear"] },
        disabledReason: "Leave planning first.",
      },
    ],
    modes: [
      {
        id: "objective",
        label: "Objective",
        description: "Finish the migration.",
        state: "Active",
        tagText: "Active: Finish the migration.",
        closeActionId: "remove-objective",
        actions: [{ id: "remove-objective", label: "Clear current objective" }],
      },
    ],
  };
  expect(harnessCommandStateSchema.parse(state)).toEqual(state);
});

test("accepts existing command presentations without tagged input", () => {
  const state = {
    slashCommands: true,
    commands: [{ name: "/compact", description: "Compact the conversation." }],
    modes: [],
  };
  expect(harnessCommandStateSchema.parse(state)).toEqual(state);
});
