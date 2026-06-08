import { Flex, Tabs } from "@chakra-ui/react";
import { type ChangedFilesViewMode, type Diff, DiffViewer } from "@pstdio/ui";
import { FileDiffIcon, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeWorkspacePageTab, type WorkspacePageTab } from "@/features/workspaces/pages/workspace-page-tab";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/shared/api-types";
import { collectChangedFilePaths } from "../utils/build-changed-files-tree";
import { sortDiffs } from "../utils/sort-diffs";
import { WorkspaceChecksPanel } from "./workspace-checks-panel";

interface WorkspaceDiffPanelProps {
  projectId?: string;
  ticketId: string;
  workspaceId: string | null;
  diffs: Diff[];
  artifacts: ApiWorkspaceArtifact[];
  changedFiles: ApiFileDiff[];
  diffGeneration: number;
  activeTab: WorkspacePageTab;
  onTabChange: (tab: WorkspacePageTab) => void;
  loading?: boolean;
}

export const buildFilteredDiffs = (input: {
  diffs: Diff[];
  normalizedSearchQuery: string;
  viewMode: ChangedFilesViewMode;
}) => {
  const { diffs, normalizedSearchQuery, viewMode } = input;
  const matchingDiffs = normalizedSearchQuery
    ? diffs.filter((diff) => (diff.newPath ?? diff.oldPath ?? "").toLowerCase().includes(normalizedSearchQuery))
    : diffs;

  return sortDiffs(matchingDiffs, viewMode);
};

export const WorkspaceDiffPanel = (props: WorkspaceDiffPanelProps) => {
  const { projectId, ticketId, diffs, artifacts, changedFiles, activeTab, onTabChange, loading = false } = props;
  const { t } = useTranslation("tickets");
  const changedFilePaths = collectChangedFilePaths(changedFiles);

  return (
    <Flex h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0" data-testid="workspace-diff-panel">
      <Tabs.Root
        value={activeTab}
        onValueChange={(details) => onTabChange(normalizeWorkspacePageTab(details.value))}
        variant="line"
        display="flex"
        flexDirection="column"
        h="full"
        minH="0"
        minW="0"
        flex="1"
        bg="bg.subtle"
        size="sm"
      >
        <Tabs.List bg="bg.subtle" borderBottomWidth="1px" borderColor="border.muted" px="xs">
          <Tabs.Trigger value="changes" gap="2xs">
            <FileDiffIcon size={14} />
            {t("workspaceDiffPanel.tabs.changes")}
          </Tabs.Trigger>
          <Tabs.Trigger value="checks" gap="2xs">
            <ShieldCheck size={14} />
            {t("workspaceDiffPanel.tabs.checks")}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="changes" flex="1" minH="0" minW="0" p="0" display="flex">
          <DiffViewer diffs={diffs} changedFilePaths={changedFilePaths} loading={loading} />
        </Tabs.Content>

        <Tabs.Content value="checks" flex="1" minH="0" minW="0" p="0" display="flex">
          <WorkspaceChecksPanel projectId={projectId} ticketId={ticketId} artifacts={artifacts} />
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
};
