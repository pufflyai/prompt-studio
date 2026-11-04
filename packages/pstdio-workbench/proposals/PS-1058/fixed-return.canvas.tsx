import { Box, Flex } from "@chakra-ui/react";
import { ListRow, ScrollArea, TreeList } from "@pstdio/ui";
import { WorkbenchIcon } from "../../src/react/shared/icon";

const FixedReturn = () => (
  <Flex direction="column" h="full" minH="0" bg="bg.subtle">
    <Box flexShrink={0}>
      <TreeList sections={[{ id: "header", nodes: [{ id: "search", label: "Search" }] }]} rowVariant="compact" />
    </Box>
    <Box role="group" aria-label="Return navigation" p="xs" flexShrink={0}>
      <ListRow
        id="return"
        role="button"
        label="Back to project"
        variant="compact"
        icon={<WorkbenchIcon name="ArrowLeft" size={14} />}
      />
    </Box>
    <ScrollArea flex="1" minH="0">
      <TreeList
        sections={[
          {
            id: "files",
            nodes: Array.from({ length: 60 }, (_, index) => ({ id: `file-${index}`, label: `File ${index + 1}` })),
          },
        ]}
        rowVariant="compact"
      />
    </ScrollArea>
  </Flex>
);

export default { title: "Proposals/PS-1058 Fixed nested navigation return", component: FixedReturn, fullscreen: true };
export const SeparateFixedGroup = {};
