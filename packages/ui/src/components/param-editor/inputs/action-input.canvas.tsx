import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ActionInput } from "./action-input";

const run = { id: "run", name: "Run" };
const meta = {
  title: "Patterns/Param Editor/Actions",
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
export default meta;
type Story = CanvasFrame<typeof meta>;
export const RepeatSelectedAction: Story = {
  id: "patterns-param-editor-actions--repeat-selected-action",
};
export const OnlyActiveActionEnabled: Story = {
  id: "patterns-param-editor-actions--only-active-action-enabled",
  args: { options: [run, { id: "stop", name: "Stop", disabled: true }] },
};
export const ReadOnly: Story = {
  id: "patterns-param-editor-actions--read-only",
  args: { readOnly: true },
};
export const NoEnabledActions: Story = {
  id: "patterns-param-editor-actions--no-enabled-actions",
  args: { options: [{ ...run, disabled: true }] },
};
