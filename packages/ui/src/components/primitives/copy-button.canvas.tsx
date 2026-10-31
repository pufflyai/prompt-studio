import { Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { CopyButton } from "./copy-button";

const meta: CanvasMeta<typeof CopyButton> = {
  title: "Components/Inputs/CopyButton",
  component: CopyButton,
  args: { text: "Build the tools that make your work easier." },
  description:
    "Copies exact text and briefly shows Copied or a retry message. Pass a function as text to read changing content at click time. Extension webviews must declare clipboard.write.",
};
export default meta;
type Story = CanvasFrame<typeof CopyButton>;
export const Default: Story = {
  id: "components-inputs-copybutton--default",
};
export const Draft: Story = {
  id: "components-inputs-copybutton--draft",
  args: {
    label: "Copy draft",
    text: "I built a daily research tool in Prompt Studio.\n\nIt finds useful conversations and suggests replies.",
  },
  render: (args) => (
    <Stack gap="sm">
      <Text textStyle="paragraph/S/regular" whiteSpace="pre-wrap">
        {typeof args.text === "function" ? args.text() : args.text}
      </Text>
      <CopyButton {...args} />
    </Stack>
  ),
};
export const Disabled: Story = {
  id: "components-inputs-copybutton--disabled",
  args: { disabled: true },
};
export const Empty: Story = {
  id: "components-inputs-copybutton--empty",
  args: { text: "" },
};
