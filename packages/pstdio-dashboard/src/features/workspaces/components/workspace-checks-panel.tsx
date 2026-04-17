import { Box, Button, Flex, Icon, Spinner, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ScrollArea } from "@pstdio/ui";
import { AlertCircle, CheckCircle2, FileCode2, FileText, FlaskConical, TerminalSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTicketContent } from "@/features/ticket/hooks/use-ticket-content";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import { buildWorkspaceChecksContentRequest } from "./workspace-checks-content-request";

interface WorkspaceChecksPanelProps {
  ticketId: string;
  artifacts: ApiWorkspaceArtifact[];
}

const resolveArtifactStatusIcon = (relativePath: string) => {
  const lower = relativePath.toLowerCase();
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

const formatArtifactRowLabel = (relativePath: string) => relativePath.replace(/^artifacts\//, "");

export const WorkspaceChecksPanel = (props: WorkspaceChecksPanelProps) => {
  const { ticketId, artifacts } = props;
  const { t } = useTranslation("tickets");
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(artifacts[0]?.id ?? null);

  useEffect(() => {
    if (artifacts.length === 0) {
      setSelectedArtifactId(null);
      return;
    }

    const stillExists = artifacts.some((artifact) => artifact.id === selectedArtifactId);
    if (!stillExists) {
      setSelectedArtifactId(artifacts[0]?.id ?? null);
    }
  }, [artifacts, selectedArtifactId]);

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
    <Flex flex="1" minH="0" bg="bg.subtle" borderTopWidth="1px">
      <Stack w="18rem" minW="18rem" h="full" gap="0" borderRightWidth="1px" bg="bg">
        <Flex h="41px" minH="41px" align="center" px="sm" borderBottomWidth="1px">
          <Text textStyle="label/S/medium" color="foreground.secondary">
            {t("workspaceDiffPanel.checks.title")}
          </Text>
        </Flex>

        <ScrollArea flex="1" minH="0" contentProps={{ p: "xs" }}>
          <Stack gap="2xs">
            {artifacts.map((artifact) => {
              const icon = resolveArtifactStatusIcon(artifact.relative_path);
              const isActive = artifact.id === selectedArtifact?.id;
              return (
                <Button
                  key={artifact.id}
                  size="sm"
                  variant="ghost"
                  justifyContent="flex-start"
                  borderRadius="xs"
                  bg={isActive ? "bg.active" : "transparent"}
                  _hover={{ bg: isActive ? "bg.active" : "bg.hover" }}
                  onClick={() => setSelectedArtifactId(artifact.id)}
                >
                  <Icon as={icon.icon} boxSize="14px" color={icon.color} />
                  <Text truncate minW="0" textStyle="paragraph/XS/regular">
                    {formatArtifactRowLabel(artifact.relative_path)}
                  </Text>
                </Button>
              );
            })}
          </Stack>
        </ScrollArea>
      </Stack>

      <Stack flex="1" minH="0" gap="0" bg="bg">
        <Flex h="41px" minH="41px" align="center" px="sm" borderBottomWidth="1px">
          <Text textStyle="label/S/medium" color="foreground.secondary" truncate>
            {selectedArtifact ? formatArtifactRowLabel(selectedArtifact.relative_path) : ""}
          </Text>
        </Flex>

        <ScrollArea flex="1" minH="0" contentProps={{ p: "sm" }}>
          {artifactContent.isLoading ? (
            <Flex align="center" gap="xs" color="foreground.secondary">
              <Spinner size="sm" />
              <Text>{t("workspaceDiffPanel.checks.loading")}</Text>
            </Flex>
          ) : (
            <Box as="pre" whiteSpace="pre-wrap" wordBreak="break-word" fontFamily="mono" fontSize="sm" lineHeight="1.5">
              {artifactContent.data ?? ""}
            </Box>
          )}
        </ScrollArea>
      </Stack>
    </Flex>
  );
};
