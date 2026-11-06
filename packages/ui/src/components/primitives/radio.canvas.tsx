import { Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ReactNode } from "react";
import { Radio, RadioGroup } from "@/components/primitives/radio";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";

const meta = {
  title: "Design system/Components/Forms/Radio",
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
export default {
  title: "Design system/Components/Forms/Radio",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const WithLabel: Story = {
  id: "components-inputs-radio--with-label",
  args: {
    value: "selected",
    children: "Use project template",
  },
};
const Disabled: Story = {
  id: "components-inputs-radio--disabled",
  args: {
    value: "disabled",
    disabled: true,
    children: "Unavailable",
  },
};
const Options: Story = {
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

const Examples = createCanvasExampleNavigator(meta, { WithLabel, Disabled, Options });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as WithLabel };
