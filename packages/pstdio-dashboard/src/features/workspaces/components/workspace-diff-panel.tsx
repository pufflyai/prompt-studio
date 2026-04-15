import { Box, Button, Flex, Menu, Stack, Text } from "@chakra-ui/react";
import { type Diff, DiffDrawer, EmptyState, MenuItem } from "@pstdio/ui";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTicketContent } from "@/features/ticket/hooks/use-ticket-content";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import {
  resolveArtifactLabel,
  resolveSelectedArtifactFileId,
  resolveWorkspacePanelTab,
  type WorkspacePanelTab,
} from "./workspace-diff-panel.utils";

interface WorkspaceDiffPanelProps {
  ticketId: string;
  diffs: Diff[];
  artifacts: ApiWorkspaceArtifact[];
}

export const WorkspaceDiffPanel = (props: WorkspaceDiffPanelProps) => {
  const { ticketId, diffs, artifacts } = props;
  const { t } = useTranslation("tickets");

  const hasDiffs = diffs.length > 0;
  const hasArtifacts = artifacts.length > 0;
  const [activeTab, setActiveTab] = useState<WorkspacePanelTab>(hasDiffs ? "changes" : "checks");
  const [hasUserSelectedTab, setHasUserSelectedTab] = useState(false);
  const [selectedArtifactFileId, setSelectedArtifactFileId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab((currentTab) =>
      resolveWorkspacePanelTab({
        hasDiffs,
        hasUserSelectedTab,
        activeTab: currentTab,
      }),
    );
  }, [hasDiffs, hasUserSelectedTab]);

  useEffect(() => {
    setSelectedArtifactFileId((currentSelection) => resolveSelectedArtifactFileId(artifacts, currentSelection));
  }, [artifacts]);

  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.file_id === selectedArtifactFileId) ?? null,
    [artifacts, selectedArtifactFileId],
  );
  const selectedArtifactLabel = selectedArtifact ? resolveArtifactLabel(selectedArtifact.relative_path) : "";
  const artifactContent = useTicketContent(ticketId, selectedArtifactFileId ?? "", {
    enabled: activeTab === "checks" && Boolean(selectedArtifactFileId),
  });

  const content = artifactContent.data ?? "";

  const renderChecks = () => {
    if (!hasArtifacts) {
      return (
        <Box flex="1" minH="0" px="md" py="lg" display="flex" alignItems="center" justifyContent="center">
          <EmptyState
            title={t("workspaceDiffPanel.checks.empty.title")}
            description={t("workspaceDiffPanel.checks.empty.description")}
          />
        </Box>
      );
    }

    return (
      <Flex flex="1" minH="0" overflow="hidden">
        <Box w="18rem" minW="16rem" borderRightWidth="1px" p="xs" overflow="auto">
          <Menu.Root>
            {artifacts.map((artifact) => {
              const label = resolveArtifactLabel(artifact.relative_path);

              return (
                <MenuItem
                  key={artifact.id}
                  primaryLabel={label}
                  variant="compact"
                  isSelected={artifact.file_id === selectedArtifactFileId}
                  onClick={() => setSelectedArtifactFileId(artifact.file_id)}
                />
              );
            })}
          </Menu.Root>
        </Box>

        <Stack flex="1" minW="0" minH="0" p="md" gap="sm" overflow="hidden">
          <Text textStyle="label/S/medium" color="foreground.secondary" truncate>
            {selectedArtifactLabel}
          </Text>

          <Box
            flex="1"
            minH="0"
            borderWidth="1px"
            borderColor="border.default"
            borderRadius="sm"
            overflow="auto"
            p="sm"
          >
            {artifactContent.isLoading ? (
              <Text textStyle="paragraph/S/regular" color="foreground.secondary">
                {t("workspaceDiffPanel.checks.loading")}
              </Text>
            ) : content ? (
              <Box as="pre" m="0" whiteSpace="pre-wrap" textStyle="paragraph/S/regular" fontFamily="mono">
                {content}
              </Box>
            ) : (
              <EmptyState
                title={t("workspaceDiffPanel.checks.noContent.title")}
                description={t("workspaceDiffPanel.checks.noContent.description")}
              />
            )}
          </Box>
        </Stack>
      </Flex>
    );
  };

  const renderChanges = () => {
    if (hasDiffs) {
      return (
        <Box flex="1" minH="0">
          <DiffDrawer diffs={diffs} />
        </Box>
      );
    }

    return (
      <Box flex="1" minH="0" px="md" py="lg" display="flex" alignItems="center" justifyContent="center">
        <EmptyState
          title={t("workspaceDiffPanel.changes.empty.title")}
          description={t("workspaceDiffPanel.changes.empty.description")}
          data-testid="workspace-diff-panel-empty"
        />
      </Box>
    );
  };

  return (
    <Stack h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0" data-testid="workspace-diff-panel">
      <Flex px="sm" py="xs" borderBottomWidth="1px" gap="xs">
        <Button
          size="sm"
          variant={activeTab === "checks" ? "surface" : "ghost"}
          onClick={() => {
            setActiveTab("checks");
            setHasUserSelectedTab(true);
          }}
        >
          {t("workspaceDiffPanel.tabs.checks")}
        </Button>
        <Button
          size="sm"
          variant={activeTab === "changes" ? "surface" : "ghost"}
          onClick={() => {
            setActiveTab("changes");
            setHasUserSelectedTab(true);
          }}
        >
          {t("workspaceDiffPanel.tabs.changes")}
        </Button>
      </Flex>

      {activeTab === "checks" ? renderChecks() : renderChanges()}
    </Stack>
  );
};
