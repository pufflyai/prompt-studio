import { Flex, Stack } from "@chakra-ui/react";
import { WorkspaceDetailTabs } from "./workspace-detail-tabs";

export const WorkspaceWidget = () => {
  return (
    <Stack flex="1" h="full" gap="0" minH="0" minW="0" bg="bg">
      <Flex flex="1" minH="0" minW="0" bg="bg.subtle">
        <WorkspaceDetailTabs />
      </Flex>
    </Stack>
  );
};
