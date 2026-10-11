import { Box, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { TreeList } from "./tree-list";

const meta = {
  title: "Components/Data Display/Tree List/Footer",
  component: TreeList,
} satisfies Meta<typeof TreeList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PinnedFooter: Story = {
  args: {
    sections: [
      {
        id: "footer",
        nodes: [
          { id: "help", label: "Help" },
          { id: "settings", label: "Settings" },
        ],
      },
    ],
    draggable: true,
    rowVariant: "compact",
    sectionGap: "md",
    nodeGap: "1px",
  },
  decorators: [
    (Story) => (
      <Stack h="lg" w="xs" gap="0" data-testid="footer-container">
        <Box flex="1">
          <Text p="xs">Project navigation</Text>
        </Box>
        <Story />
      </Stack>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const settings = await canvas.findByRole("option", { name: "Settings", exact: true });
    const footer = canvas.getByTestId("footer-container");
    await expect(footer.getBoundingClientRect().bottom - settings.getBoundingClientRect().bottom).toBe(8);
  },
};
