import { Box, Menu, Stack, Text } from "@chakra-ui/react";
import { type Diff, DiffDrawer, EmptyState, MenuItem } from "@pstdio/ui";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";

interface WorkspaceDiffPanelProps {
  diffs: Diff[];
  artifacts: ApiWorkspaceArtifact[];
}

const resolveArtifactLabel = (relativePath: string) => {
  const segments = relativePath.split("/");
  const fileName = segments.at(-1) ?? relativePath;
  const directory = segments.length > 1 ? `${segments.slice(0, -1).join("/")}/` : "";

  const extensionStart = fileName.startsWith(".") ? fileName.indexOf(".", 1) : fileName.lastIndexOf(".");
  const baseName = extensionStart > 0 ? fileName.slice(0, extensionStart) : fileName;

  return `${directory}${baseName}`;
};

export const WorkspaceDiffPanel = (props: WorkspaceDiffPanelProps) => {
  const { diffs, artifacts } = props;

  const hasDiffs = diffs.length > 0;
  const hasArtifacts = artifacts.length > 0;

  return (
    <Stack h="full" minH="0" minW="0" flex="1" bg="bg.subtle" gap="0" data-testid="workspace-diff-panel">
      {hasArtifacts ? (
        <Stack gap="0" px="sm" py="xs" borderBottomWidth={hasDiffs ? "1px" : "0"}>
          <Text textStyle="label/S/medium" color="foreground.secondary" py="xs">
            Artifacts
          </Text>

          <Menu.Root>
            {artifacts.map((artifact) => {
              const label = resolveArtifactLabel(artifact.relative_path);

              return <MenuItem key={artifact.id} primaryLabel={label} variant="compact" />;
            })}
          </Menu.Root>
        </Stack>
      ) : null}

      {hasDiffs ? (
        <Box flex="1" minH="0">
          <DiffDrawer diffs={diffs} />
        </Box>
      ) : (
        <Box flex="1" minH="0" px="md" py="lg" display="flex" alignItems="center" justifyContent="center">
          <EmptyState
            title="No diffs yet"
            description="Changes in this workspace will appear here once files are modified."
            data-testid="workspace-diff-panel-empty"
          />
        </Box>
      )}
    </Stack>
  );
};
