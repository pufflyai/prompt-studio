import { Box, Flex, Menu, Spinner, Stack, Text } from "@chakra-ui/react";
import { EmptyState, MenuItem } from "@pstdio/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import { useArtifactContent } from "../hooks/use-artifact-content";
import { resolveSelectedArtifact } from "../utils/artifact-selection";
import { resolveArtifactLabel } from "../utils/resolve-artifact-label";

interface ChecksPanelProps {
  ticketId: string;
  artifacts: ApiWorkspaceArtifact[];
}

export const ChecksPanel = (props: ChecksPanelProps) => {
  const { ticketId, artifacts } = props;
  const { t } = useTranslation("tickets");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const effectiveId = resolveSelectedArtifact(artifacts, selectedId);
  const selectedArtifact = artifacts.find((a) => a.id === effectiveId);
  const { data: content, isLoading } = useArtifactContent(ticketId, selectedArtifact?.file_id ?? null);

  if (artifacts.length === 0) {
    return (
      <Box flex="1" minH="0" px="md" py="lg" display="flex" alignItems="center" justifyContent="center">
        <EmptyState
          title={t("workspacePanel.artifacts.empty.title")}
          description={t("workspacePanel.artifacts.empty.description")}
          data-testid="checks-panel-empty"
        />
      </Box>
    );
  }

  return (
    <Flex flex="1" minH="0" direction="column">
      <Stack gap="0" px="sm" py="xs" borderBottomWidth="1px">
        <Text textStyle="label/S/medium" color="foreground.secondary" py="xs">
          {t("workspacePanel.artifacts.label")}
        </Text>
        <Menu.Root>
          {artifacts.map((artifact) => {
            const label = resolveArtifactLabel(artifact.relative_path);
            const isSelected = artifact.id === effectiveId;

            return (
              <MenuItem
                key={artifact.id}
                primaryLabel={label}
                variant="compact"
                isSelected={isSelected}
                onClick={() => setSelectedId(artifact.id)}
              />
            );
          })}
        </Menu.Root>
      </Stack>

      <Box flex="1" minH="0" overflow="auto" p="sm">
        {isLoading ? (
          <Flex justify="center" align="center" h="full">
            <Spinner size="sm" />
          </Flex>
        ) : (
          <Text as="pre" textStyle="paragraph/S/regular" whiteSpace="pre-wrap" wordBreak="break-word">
            {content}
          </Text>
        )}
      </Box>
    </Flex>
  );
};
