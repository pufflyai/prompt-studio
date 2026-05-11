import { Box, Flex, Skeleton, Stack } from "@chakra-ui/react";
import { HorizontalMenuStack, PanelLayout } from "@pstdio/ui";
import { useDeferredPageMount } from "@/shared/performance/use-deferred-page-mount";
import { WorkspaceDiffPanel } from "../components/workspace-diff-panel";
import type { WorkspacePageTab } from "./workspace-page-tab";

interface WorkspacePagePendingShellProps {
  activeTab: WorkspacePageTab;
  onTabChange: (tab: WorkspacePageTab) => void;
}

export const WorkspacePagePendingShell = (props: WorkspacePagePendingShellProps) => {
  const { activeTab, onTabChange } = props;

  useDeferredPageMount("workspace");

  const sidebar = (
    <Stack h="full" gap="0" bg="bg" borderRightWidth="1px" borderColor="border.muted">
      <Box p="sm" borderBottomWidth="1px" borderColor="border.muted">
        <Skeleton height="22px" borderRadius="sm" />
      </Box>
      <Stack gap="xs" p="sm">
        <Skeleton height="24px" borderRadius="sm" />
        <Skeleton height="24px" borderRadius="sm" />
        <Skeleton height="24px" borderRadius="sm" />
      </Stack>
    </Stack>
  );

  return (
    <PanelLayout sidebar={sidebar}>
      <Stack flex="1" gap="0" minH="0">
        <HorizontalMenuStack>
          <Flex align="center" gap="sm" w="20rem">
            <Skeleton height="22px" borderRadius="sm" flex="1" />
          </Flex>
        </HorizontalMenuStack>
        <Flex flex="1" minH="0">
          <WorkspaceDiffPanel
            ticketId=""
            workspaceId={null}
            diffs={[]}
            artifacts={[]}
            changedFiles={[]}
            diffGeneration={0}
            loading
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        </Flex>
      </Stack>
    </PanelLayout>
  );
};
