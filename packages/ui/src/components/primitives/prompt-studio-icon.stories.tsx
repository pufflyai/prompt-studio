import { Box, HStack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PromptStudioIcon } from "./prompt-studio-icon";

const meta = {
  title: "Primitives/Prompt Studio Icon",
  component: PromptStudioIcon,
  render: () => (
    <Box width="48px" height="48px" color="fg">
      <PromptStudioIcon />
    </Box>
  ),
} satisfies Meta<typeof PromptStudioIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The mark inherits `color`, so it reads as an avatar on any surface. */
export const Sizes: Story = {
  render: () => (
    <HStack gap="16px" align="center" color="fg">
      {[12, 16, 24, 48].map((size) => (
        <Box key={size} width={`${size}px`} height={`${size}px`}>
          <PromptStudioIcon />
        </Box>
      ))}
    </HStack>
  ),
};
