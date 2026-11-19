import { Box, Button, Flex, HStack } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { Workbench } from "../workbench/workbench";
import { createResourcePagesWorkbench } from "./resource-pages.fixture";

export default {
  title: "Product/Workbench/Panels/Movable resource pages",
  description:
    "Page and tab headers, portable native state, resource reuse and Properties. Uses real workbench controllers with synthetic resources.",
  fullscreen: true,
} satisfies CanvasMeta;

export const Interactive = () => {
  const [example] = useState(createResourcePagesWorkbench);
  return (
    <Flex h="100dvh" minH="0" direction="column">
      <HStack p="xs" flexShrink={0}>
        <Button size="xs" onClick={example.home}>
          Open Home
        </Button>
        <Button size="xs" onClick={example.tabs}>
          Open tabbed page
        </Button>
        <Button size="xs" onClick={() => example.open("A")}>
          Open A in Main
        </Button>
        <Button size="xs" onClick={() => example.open("B")}>
          Open B in Main
        </Button>
      </HStack>
      <Box flex="1" minH="0">
        <Workbench workbench={example.workbench} />
      </Box>
    </Flex>
  );
};
