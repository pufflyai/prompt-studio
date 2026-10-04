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
        indicator: { label: "Active", tone: "success" as const },
        tagText: "Active: Finish the migration.",
        closeActionId: "remove-objective",
        actions: [{ id: "remove-objective", label: "Clear current objective", icon: "trash-2" }],
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

test("preserves a provider-owned mode confirmation and its native revision", () => {
  const state = {
    slashCommands: true,
    commands: [],
    modes: [
      {
        id: "planning",
        label: "Plan",
        description: "Build the agreed feature.",
        state: "Awaiting approval",
        confirmation: {
          id: "native-plan-revision",
          title: "Approve plan",
          actionId: "implement",
          cancelLabel: "Keep planning",
          model: "native-model",
        },
        actions: [{ id: "implement", label: "Approve and implement" }],
      },
    ],
  };
  expect(harnessCommandStateSchema.parse(state)).toEqual(state);
});
