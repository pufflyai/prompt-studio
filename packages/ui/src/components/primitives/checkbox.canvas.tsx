import { Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ReactNode } from "react";
import { Checkbox } from "@/components/primitives/checkbox";

const meta = {
  title: "Components/Inputs/Checkbox",
  component: Checkbox,
  decorators: [
    (Story: () => ReactNode) => (
      <div style={{ padding: "24px", width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies CanvasMeta<typeof Checkbox>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Default: Story = {
  id: "components-inputs-checkbox--default",
};
export const DefaultChecked: Story = {
  id: "components-inputs-checkbox--default-checked",
  args: {
    defaultChecked: true,
  },
};
export const WithLabel: Story = {
  id: "components-inputs-checkbox--with-label",
  args: {
    children: "Enable project template",
  },
};
export const Disabled: Story = {
  id: "components-inputs-checkbox--disabled",
  args: {
    disabled: true,
    children: "Unavailable",
  },
};
export const DisabledChecked: Story = {
  id: "components-inputs-checkbox--disabled-checked",
  args: {
    disabled: true,
    defaultChecked: true,
    children: "Locked on",
  },
};
export const Sizes: Story = {
  id: "components-inputs-checkbox--sizes",
  render: () => (
    <Stack gap="md">
      <Checkbox size="sm">Small</Checkbox>
      <Checkbox size="md">Medium</Checkbox>
      <Checkbox size="lg">Large</Checkbox>
    </Stack>
  ),
};
