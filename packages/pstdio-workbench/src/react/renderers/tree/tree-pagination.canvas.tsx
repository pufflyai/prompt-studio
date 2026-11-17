import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { createTreePaginationFixture } from "./tree-pagination.fixture";
import { WorkbenchTreeView } from "./tree-view";

const History = () => {
  const [, changed] = useState(0);
  const [fixture] = useState(() => createTreePaginationFixture(() => changed((value) => value + 1)));
  const refresh = () => fixture.workbench.views.refreshView("history");
  return (
    <Stack h="96" w="80" gap="xs">
      <HStack flexWrap="wrap" flexShrink="0">
        <Button
          onClick={() => {
            fixture.fail = true;
          }}
        >
          Fail next read
        </Button>
        <Button
          onClick={() => {
            fixture.hold = !fixture.hold;
            changed((value) => value + 1);
          }}
        >
          {fixture.hold ? "Release reads" : "Hold reads"}
        </Button>
        <Button
          onClick={() => {
            fixture.hold = false;
            for (const release of fixture.pending.splice(0)) release();
            changed((value) => value + 1);
          }}
        >
          Finish reads
        </Button>
        <Button
          onClick={() => {
            fixture.nested = !fixture.nested;
            refresh();
          }}
        >
          Toggle workspace group
        </Button>
        <Button onClick={refresh}>Refresh</Button>
      </HStack>
      <Text as="output" aria-label="Page requests" flexShrink="0">
        {fixture.requests}
      </Text>
      <WorkbenchTreeView workbench={fixture.workbench} treeViewId="history" />
    </Stack>
  );
};

const meta = {
  title: "Product/Workbench/Navigation/Tree/Infinite session history",
  component: History,
  description:
    "Scroll through bounded pages in the real virtual tree; explore workspace groups, inline Retry, held responses and search changes.",
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof History>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const InfiniteHistory: Story = { id: "workbench-tree-infinite-session-history" };
