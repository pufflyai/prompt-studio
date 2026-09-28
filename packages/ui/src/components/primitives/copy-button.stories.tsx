import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { CopyButton } from "./copy-button";

const meta: Meta<typeof CopyButton> = {
  title: "Components/Inputs/CopyButton",
  component: CopyButton,
  args: { text: "Build the tools that make your work easier." },
  parameters: {
    docs: {
      description: {
        component:
          "Copies exact text and briefly shows Copied or a retry message. Extension webviews must declare clipboard.write.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof CopyButton>;
export const Default: Story = {};
export const Draft: Story = {
  args: {
    label: "Copy draft",
    text: "I built a daily research tool in Prompt Studio.\n\nIt finds useful conversations and suggests replies.",
  },
  render: (args) => (
    <Stack gap="sm">
      <Text textStyle="paragraph/S/regular" whiteSpace="pre-wrap">
        {args.text}
      </Text>
      <CopyButton {...args} />
    </Stack>
  ),
};
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { text: "" } };
