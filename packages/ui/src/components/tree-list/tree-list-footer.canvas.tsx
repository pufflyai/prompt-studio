import { Box, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { TreeList } from "./tree-list";

const meta = {
  title: "Components/Data Display/Tree List/Footer",
  component: TreeList,
} satisfies CanvasMeta<typeof TreeList>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const PinnedFooter: Story = {
  id: "components-data-display-tree-list-footer--pinned-footer",
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
};
