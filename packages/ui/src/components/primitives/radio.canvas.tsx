import { Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ReactNode } from "react";
import { Radio, RadioGroup } from "@/components/primitives/radio";

const meta = {
  title: "Components/Inputs/Radio",
  component: Radio,
  decorators: [
    (Story: () => ReactNode) => (
      <div style={{ padding: "24px", width: "320px" }}>
        <RadioGroup defaultValue="selected">
          <Story />
        </RadioGroup>
      </div>
    ),
  ],
} satisfies CanvasMeta<typeof Radio>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const WithLabel: Story = {
  id: "components-inputs-radio--with-label",
  args: {
    value: "selected",
    children: "Use project template",
  },
};
export const Disabled: Story = {
  id: "components-inputs-radio--disabled",
  args: {
    value: "disabled",
    disabled: true,
    children: "Unavailable",
  },
};
export const Options: Story = {
  id: "components-inputs-radio--options",
  args: {
    value: "selected",
  },
  render: () => (
    <Stack gap="sm">
      <Radio value="selected">TypeScript</Radio>
      <Radio value="python">Python</Radio>
      <Radio value="go">Go</Radio>
    </Stack>
  ),
};
