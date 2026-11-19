import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { HarnessModelPicker } from "./harness-model-picker";

// Synthetic extension icons: harnesses show their extension's SVG.
const svgIcon = (body: string) =>
  `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${body}</svg>`)}`;
const codexIcon = svgIcon('<circle cx="8" cy="8" r="6" fill="#10a37f"/>');
const claudeIcon = svgIcon('<rect x="2" y="2" width="12" height="12" rx="3" fill="#d97757"/>');

const meta: CanvasMeta<typeof HarnessModelPicker> = {
  title: "Design system/Patterns/Parameter editor/Harness model picker",
  component: HarnessModelPicker,
  args: {
    label: "Supervisor model",
    harnessId: "codex",
    model: "small",
    harnesses: [
      { id: "codex", name: "Codex", icon: codexIcon },
      { id: "claude", name: "Claude Code", icon: claudeIcon },
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
export default {
  title: "Design system/Patterns/Parameter editor/Harness model picker",
  fullscreen: true,
};
type Story = CanvasFrame<typeof HarnessModelPicker>;
const Default: Story = {
  id: "components-param-editor-harness-model-picker--default",
};
const Loading: Story = {
  id: "components-param-editor-harness-model-picker--loading",
  args: { models: [], loadingModels: true },
};
const UnavailableHarness: Story = {
  id: "components-param-editor-harness-model-picker--unavailable-harness",
  args: {
    harnesses: [
      { id: "codex", name: "Codex", icon: codexIcon },
      { id: "claude", name: "Claude Code", icon: claudeIcon, disabled: true },
    ],
  },
};

const NoExtensionIcon: Story = {
  id: "components-param-editor-harness-model-picker--no-extension-icon",
  args: { harnesses: [{ id: "codex", name: "Codex" }] },
};

const Examples = createCanvasExampleNavigator(meta, { Default, Loading, UnavailableHarness, NoExtensionIcon });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Default };
