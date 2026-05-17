import { Box, Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { HarnessDefaultModelCard } from "./harness-default-model-card";

const meta: Meta<typeof HarnessDefaultModelCard> = {
  title: "ProjectSettings/HarnessDefaultModelCard",
  component: HarnessDefaultModelCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Box maxWidth="720px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof HarnessDefaultModelCard>;

export const Selected: Story = {
  args: {
    children: (
      <Button size="sm" variant="ghost">
        claude-3-5-sonnet
      </Button>
    ),
  },
};
