import { Box, Stack, Tabs } from "@chakra-ui/react";
import { type Diff, DiffDrawer, EmptyState } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import { ChecksPanel } from "./checks-panel";

interface WorkspaceDiffPanelProps {
  ticketId: string;
  diffs: Diff[];
  artifacts: ApiWorkspaceArtifact[];
}

export const WorkspaceDiffPanel = (props: WorkspaceDiffPanelProps) => {
  const { ticketId, diffs, artifacts } = props;
  const { t } = useTranslation("tickets");

  return (
    <Tabs.Root defaultValue="changes" h="full" minH="0" minW="0" flex="1" display="flex" flexDirection="column">
      <Tabs.List bg="bg.subtle" px="sm">
        <Tabs.Trigger value="changes" data-testid="workspace-tab-changes">
          {t("workspacePanel.tabs.changes")}
        </Tabs.Trigger>
        <Tabs.Trigger value="checks" data-testid="workspace-tab-checks">
          {t("workspacePanel.tabs.checks")}
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="changes" flex="1" minH="0" p="0" display="flex" flexDirection="column">
        <Stack h="full" minH="0" bg="bg.subtle" gap="0" data-testid="workspace-diff-panel">
          {diffs.length > 0 ? (
            <Box flex="1" minH="0">
              <DiffDrawer diffs={diffs} />
            </Box>
          ) : (
            <Box flex="1" minH="0" px="md" py="lg" display="flex" alignItems="center" justifyContent="center">
              <EmptyState
                title={t("workspacePanel.diffs.empty.title")}
                description={t("workspacePanel.diffs.empty.description")}
                data-testid="workspace-diff-panel-empty"
              />
            </Box>
          )}
        </Stack>
      </Tabs.Content>

      <Tabs.Content value="checks" flex="1" minH="0" p="0" display="flex" flexDirection="column" bg="bg.subtle">
        <ChecksPanel ticketId={ticketId} artifacts={artifacts} />
      </Tabs.Content>
    </Tabs.Root>
  );
};
