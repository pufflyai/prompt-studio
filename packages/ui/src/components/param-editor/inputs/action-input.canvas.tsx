import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { ActionInput } from "./action-input";

const run = { id: "run", name: "Run" };
const meta = {
  title: "Design system/Patterns/Parameter editor/Actions",
  component: ActionInput,
  args: {
    id: "action",
    name: "Action",
    defaultValue: "run",
    options: [run],
    presentation: "horizontal",
    onChange: () => {},
  },
} satisfies CanvasMeta<typeof ActionInput>;
export default {
  title: "Design system/Patterns/Parameter editor/Actions",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const RepeatSelectedAction: Story = {
  id: "patterns-param-editor-actions--repeat-selected-action",
};
const OnlyActiveActionEnabled: Story = {
  id: "patterns-param-editor-actions--only-active-action-enabled",
  args: { options: [run, { id: "stop", name: "Stop", disabled: true }] },
};
const ReadOnly: Story = {
  id: "patterns-param-editor-actions--read-only",
  args: { readOnly: true },
};
const NoEnabledActions: Story = {
  id: "patterns-param-editor-actions--no-enabled-actions",
  args: { options: [{ ...run, disabled: true }] },
};

const Examples = createCanvasExampleNavigator(meta, {
  RepeatSelectedAction,
  OnlyActiveActionEnabled,
  ReadOnly,
  NoEnabledActions,
});
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as RepeatSelectedAction };
