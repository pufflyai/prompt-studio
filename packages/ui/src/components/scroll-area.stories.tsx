import { Box, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ScrollArea } from "./scroll-area";

const items = Array.from({ length: 24 }, (_, index) => `Scrollable row ${index + 1}`);

const meta: Meta<typeof ScrollArea> = {
  title: "Components/Layout/Scroll Area",
  component: ScrollArea,
  decorators: [
    (Story) => (
      <Box bg="bg" maxW="560px" p="lg">
        <Story />
      </Box>
    ),
  ],
  args: {
    maxH: "14rem",
    borderWidth: "1px",
    borderColor: "border.muted",
    borderRadius: "md",
    contentProps: {
      p: "sm",
      spaceY: "xs",
    },
  },
};

export default meta;

type Story = StoryObj<typeof ScrollArea>;

export const Vertical: Story = {
  render: (args) => (
    <ScrollArea {...args}>
      {items.map((item) => (
        <Text key={item} textStyle="paragraph/S/regular">
          {item}
        </Text>
      ))}
    </ScrollArea>
  ),
};

export const BothDirections: Story = {
  args: {
    showHorizontalScrollbar: true,
    maxW: "24rem",
    contentProps: {
      p: "sm",
      minW: "42rem",
    },
  },
  render: (args) => (
    <ScrollArea {...args}>
      <Stack gap="xs">
        {items.slice(0, 12).map((item) => (
          <Text key={item} textStyle="paragraph/S/regular">
            {item} with extra content to demonstrate horizontal scrolling.
          </Text>
        ))}
      </Stack>
    </ScrollArea>
  ),
};
