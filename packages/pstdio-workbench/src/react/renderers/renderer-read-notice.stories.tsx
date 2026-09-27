import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { RendererReadNotice } from "./renderer-read-notice";

const meta = {
  title: "Renderers/Read failure",
  component: RendererReadNotice,
  args: { error: "The view could not be refreshed. Try again.", retry: () => {} },
} satisfies Meta<typeof RendererReadNotice>;
export default meta;
type Story = StoryObj<typeof RendererReadNotice>;

export const InitialFailure: Story = {};
export const Deadline: Story = { args: { error: "The view took too long to load. Try again." } };
export const RetainedContent: Story = {
  render: (args) => (
    <Stack gap="md">
      <RendererReadNotice {...args} />
      <Text>Previously loaded content remains visible.</Text>
    </Stack>
  ),
};
