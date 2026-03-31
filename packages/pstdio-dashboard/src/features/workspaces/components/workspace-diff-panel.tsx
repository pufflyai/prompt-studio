import { Box, Flex, Menu, Stack, Text } from "@chakra-ui/react";
import { type Diff, DiffDrawer, MenuItem } from "@pstdio/ui";
import { ArrowRight } from "lucide-react";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";

interface WorkspaceDiffPanelProps {
  diffs: Diff[];
  artifacts: ApiWorkspaceArtifact[];
  baseRef?: string;
  headRef?: string;
}

export const WorkspaceDiffPanel = (props: WorkspaceDiffPanelProps) => {
  const { diffs, artifacts, baseRef, headRef } = props;

  const hasDiffs = diffs.length > 0;
  const hasArtifacts = artifacts.length > 0;

  if (!hasDiffs && !hasArtifacts) return null;

  return (
    <Stack
      h="full"
      minH="0"
      minW="0"
      flex="1"
      borderLeftWidth="1px"
      bg="bg.subtle"
      gap="0"
      data-testid="workspace-diff-panel"
    >
      {baseRef && headRef ? (
        <Flex align="center" gap="xs" px="sm" py="xs" borderBottomWidth="1px">
          <Text textStyle="label/S/medium" color="foreground.secondary">
            {baseRef}
          </Text>
          <ArrowRight size={12} color="var(--chakra-colors-foreground-tertiary)" />
          <Text textStyle="label/S/medium" color="foreground.secondary">
            {headRef}
          </Text>
        </Flex>
      ) : null}

      {hasArtifacts ? (
        <Stack gap="0" px="sm" py="xs" borderBottomWidth={hasDiffs ? "1px" : "0"}>
          <Text textStyle="label/S/medium" color="foreground.secondary" py="xs">
            Artifacts
          </Text>

          <Menu.Root>
            {artifacts.map((artifact) => {
              const lastDot = artifact.relative_path.lastIndexOf(".");
              const label = lastDot > 0 ? artifact.relative_path.slice(0, lastDot) : artifact.relative_path;

              return <MenuItem key={artifact.id} primaryLabel={label} variant="compact" />;
            })}
          </Menu.Root>
        </Stack>
      ) : null}

      {hasDiffs ? (
        <Box flex="1" minH="0">
          <DiffDrawer diffs={diffs} />
        </Box>
      ) : null}
    </Stack>
  );
};
