import { Box, Flex, Image, Spinner, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ScrollArea } from "@pstdio/ui";
import { AlertCircle, CheckCircle2, FileCode2, FileText, FlaskConical, TerminalSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTicketContent } from "@/features/ticket/hooks/use-ticket-content";
import { isImageFileName } from "@/features/ticket/utils/ticket-file-selection";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import type { ChangedFilesViewMode } from "../utils/build-changed-files-tree";
import { buildWorkspaceChecksContentRequest } from "./workspace-checks-content-request";
import { type FileIconInfo, FileListPanel, ResizableLeftPanel } from "./workspace-file-list-panel";

interface WorkspaceChecksPanelProps {
  ticketId: string;
  artifacts: ApiWorkspaceArtifact[];
}

const stripArtifactPrefix = (relativePath: string) => relativePath.replace(/^artifacts\//, "");

const resolveArtifactFileIcon = (path: string): FileIconInfo => {
  const lower = path.toLowerCase();
  if (lower.includes("fail") || lower.includes("error")) return { icon: AlertCircle, color: "fg.error" };
  if (lower.includes("pass") || lower.includes("ok") || lower.includes("success")) {
    return { icon: CheckCircle2, color: "fg.success" };
  }
  if (lower.includes("test")) return { icon: FlaskConical, color: "fg.muted" };
  if (lower.endsWith(".json") || lower.endsWith(".xml") || lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return { icon: FileCode2, color: "fg.subtle" };
  }
  if (lower.endsWith(".log") || lower.includes("lint") || lower.includes("validate")) {
    return { icon: TerminalSquare, color: "fg.subtle" };
  }
  return { icon: FileText, color: "fg.subtle" };
};

export const WorkspaceChecksPanel = (props: WorkspaceChecksPanelProps) => {
  const { ticketId, artifacts } = props;
  const { t } = useTranslation("tickets");
  const [viewMode, setViewMode] = useState<ChangedFilesViewMode>("nested");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(() =>
    artifacts[0] ? stripArtifactPrefix(artifacts[0].relative_path) : null,
  );

  const artifactByDisplayPath = new Map<string, ApiWorkspaceArtifact>();
  artifacts.forEach((artifact) => {
    artifactByDisplayPath.set(stripArtifactPrefix(artifact.relative_path), artifact);
  });

  const allPaths = Array.from(artifactByDisplayPath.keys());
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredPaths = !normalizedSearchQuery
    ? allPaths
    : allPaths.filter((path) => path.toLowerCase().includes(normalizedSearchQuery));

  useEffect(() => {
    if (selectedPath && artifactByDisplayPath.has(selectedPath)) return;
    setSelectedPath(filteredPaths[0] ?? allPaths[0] ?? null);
  }, [allPaths, artifactByDisplayPath, filteredPaths, selectedPath]);

  const selectedArtifactId = selectedPath ? (artifactByDisplayPath.get(selectedPath)?.id ?? null) : null;
  const { selectedArtifact, refreshKey } = buildWorkspaceChecksContentRequest(artifacts, selectedArtifactId);
  const artifactContent = useTicketContent(ticketId, selectedArtifact?.file_id ?? "", {
    enabled: Boolean(selectedArtifact),
    refreshKey,
  });

  if (artifacts.length === 0) {
    return (
      <Box flex="1" minH="0" px="md" py="lg" display="flex" alignItems="center" justifyContent="center">
        <EmptyState
          title={t("workspaceDiffPanel.checks.emptyTitle")}
          description={t("workspaceDiffPanel.checks.emptyDescription")}
        />
      </Box>
    );
  }

  return (
    <Flex flex="1" minH="0" bg="bg.subtle">
      <ResizableLeftPanel>
        <FileListPanel
          title={t("workspaceDiffPanel.checks.title")}
          paths={filteredPaths}
          selectedPath={selectedPath}
          onSelectPath={setSelectedPath}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          resolveFileIcon={resolveArtifactFileIcon}
          showHeader={false}
          showFilter={false}
        />
      </ResizableLeftPanel>

      <Stack flex="1" minH="0" gap="0" bg="bg">
        <Flex h="41px" minH="41px" align="center" px="sm" borderBottomWidth="1px">
          <Text textStyle="label/S/medium" color="foreground.secondary" truncate>
            {selectedArtifact ? stripArtifactPrefix(selectedArtifact.relative_path) : ""}
          </Text>
        </Flex>

        {selectedArtifact && isImageFileName(selectedArtifact.relative_path) ? (
          <Box flex="1" minH="0" overflow="auto" p="md" display="flex" alignItems="center" justifyContent="center">
            <Image
              src={`/v1/tickets/${ticketId}/files/${selectedArtifact.file_id}/content`}
              alt={stripArtifactPrefix(selectedArtifact.relative_path)}
              maxW="100%"
              maxH="100%"
              objectFit="contain"
            />
          </Box>
        ) : (
          <ScrollArea flex="1" minH="0" contentProps={{ p: "sm" }}>
            {artifactContent.isLoading ? (
              <Flex align="center" gap="xs" color="foreground.secondary">
                <Spinner size="sm" />
                <Text>{t("workspaceDiffPanel.checks.loading")}</Text>
              </Flex>
            ) : (
              <Box
                as="pre"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                fontFamily="mono"
                fontSize="sm"
                lineHeight="1.5"
              >
                {artifactContent.data ?? ""}
              </Box>
            )}
          </ScrollArea>
        )}
      </Stack>
    </Flex>
  );
};
