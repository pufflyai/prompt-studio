import { Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ReactNode } from "react";
import { Checkbox } from "@/components/primitives/checkbox";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";

const meta = {
  title: "Design system/Components/Forms/Checkbox",
  component: Checkbox,
  decorators: [
    (Story: () => ReactNode) => (
      <div style={{ padding: "24px", width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies CanvasMeta<typeof Checkbox>;
export default {
  title: "Design system/Components/Forms/Checkbox",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const Default: Story = {
  id: "components-inputs-checkbox--default",
};
const DefaultChecked: Story = {
  id: "components-inputs-checkbox--default-checked",
  args: {
    defaultChecked: true,
  },
};
const WithLabel: Story = {
  id: "components-inputs-checkbox--with-label",
  args: {
    children: "Enable project template",
  },
};
const Disabled: Story = {
  id: "components-inputs-checkbox--disabled",
  args: {
    disabled: true,
    children: "Unavailable",
  },
};
const DisabledChecked: Story = {
  id: "components-inputs-checkbox--disabled-checked",
  args: {
    disabled: true,
    defaultChecked: true,
    children: "Locked on",
  },
};
const Sizes: Story = {
  id: "components-inputs-checkbox--sizes",
  render: () => (
    <Stack gap="md">
      <Checkbox size="sm">Small</Checkbox>
      <Checkbox size="md">Medium</Checkbox>
      <Checkbox size="lg">Large</Checkbox>
    </Stack>
  ),
};

const Examples = createCanvasExampleNavigator(meta, {
  Default,
  DefaultChecked,
  WithLabel,
  Disabled,
  DisabledChecked,
  Sizes,
});
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Default };
