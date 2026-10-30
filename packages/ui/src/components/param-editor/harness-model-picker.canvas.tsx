import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { HarnessModelPicker } from "./harness-model-picker";

const meta: CanvasMeta<typeof HarnessModelPicker> = {
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
type Story = CanvasVariant<typeof HarnessModelPicker>;
export const Default: Story = {
  id: "components-param-editor-harness-model-picker--default",
};
export const Loading: Story = {
  id: "components-param-editor-harness-model-picker--loading",
  args: { models: [], loadingModels: true },
};
export const UnavailableHarness: Story = {
  id: "components-param-editor-harness-model-picker--unavailable-harness",
  args: {
    harnesses: [
      { id: "codex", name: "Codex" },
      { id: "claude", name: "Claude Code", disabled: true },
    ],
  },
};
