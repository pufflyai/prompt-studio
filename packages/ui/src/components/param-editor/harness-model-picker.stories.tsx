import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { HarnessModelPicker } from "./harness-model-picker";

const meta: Meta<typeof HarnessModelPicker> = {
  title: "Components/Param Editor/Harness model picker",
  component: HarnessModelPicker,
  args: {
    label: "Supervisor model",
    harnessId: "codex",
    model: "small",
    harnesses: [
      { id: "codex", name: "Codex" },
      { id: "claude", name: "Claude Code" },
    ],
    models: [
      { id: "small", name: "Small model" },
      { id: "large", name: "Large model" },
    ],
    onHarnessChange: () => {},
    onModelChange: () => {},
  },
  render: function Preview(args) {
    const [harnessId, setHarnessId] = useState(args.harnessId);
    const [model, setModel] = useState(args.model);
    return (
      <HarnessModelPicker
        {...args}
        harnessId={harnessId}
        model={model}
        onHarnessChange={setHarnessId}
        onModelChange={setModel}
      />
    );
  },
};
export default meta;
type Story = StoryObj<typeof HarnessModelPicker>;
export const Default: Story = {};
export const Loading: Story = { args: { models: [], loadingModels: true } };
export const UnavailableHarness: Story = {
  args: {
    harnesses: [
      { id: "codex", name: "Codex" },
      { id: "claude", name: "Claude Code", disabled: true },
    ],
  },
};
