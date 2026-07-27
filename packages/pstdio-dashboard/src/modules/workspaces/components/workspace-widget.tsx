import { Box, Flex } from "@chakra-ui/react";
import { resolveFileIconElement, useFileIconThemePreference } from "@pstdio/ui";
import { type Diff, DiffViewer } from "@pstdio/ui/diff";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { resolveWorkspaceForkPointDiffWorkspaceId } from "./workspace-widget-state";

interface WorkspaceDiffResponseFile extends Diff {
  filePath: string;
}

interface WorkspaceDiffResponse {
  files: WorkspaceDiffResponseFile[];
}

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";

const toDiff = (file: WorkspaceDiffResponseFile): Diff => ({
  change: file.change,
  oldPath: file.oldPath ?? file.filePath,
  newPath: file.newPath ?? file.filePath,
  oldContent: file.oldContent,
  newContent: file.newContent,
  additions: file.additions,
  deletions: file.deletions,
});

const useWorkspaceDiffs = (workspaceId: string | undefined) => {
  const [diffs, setDiffs] = useState<Diff[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setDiffs([]);
      setLoading(false);
      return;
    }

    let disposed = false;
    setLoading(true);
    void apiRequest<WorkspaceDiffResponse | null>(`/v1/workspaces/${workspaceId}/diff?mode=fork_point`, {
      allowNotFound: true,
    })
      .then((response) => {
        if (!disposed) setDiffs(response?.files.map(toDiff) ?? []);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [workspaceId]);

  return { diffs, loading };
};

const WorkspaceChangesTab = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const workspaceId = resolveWorkspaceForkPointDiffWorkspaceId({
    resourceId: input.instance.resource?.id,
    metadata: input.instance.resource?.metadata,
  });
  const { diffs, loading } = useWorkspaceDiffs(workspaceId);
  const changedFilePaths = diffs.map(getDiffPath);
  const { activeFileIconTheme } = useFileIconThemePreference();

  const resolveFileIcon = (path: string) => {
    const fileName = path.split("/").pop() ?? path;
    return { icon: resolveFileIconElement(fileName, { theme: activeFileIconTheme }), color: "fg.subtle" };
  };

  return (
    <DiffViewer
      diffs={diffs}
      changedFilePaths={changedFilePaths}
      defaultSelectedPath={changedFilePaths[0]}
      loading={loading}
      resolveFileIcon={resolveFileIcon}
    />
  );
};

export const WorkspaceWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;

  return (
    <Flex direction="column" h="full" minH="0" minW="0" bg="bg">
      {/* Absolute fill gives the diff viewer a definite height so its file tree
          and diff list scroll independently instead of growing the whole widget. */}
      <Box position="relative" flex="1" minH="0" minW="0">
        <Box position="absolute" inset="0" display="flex" minH="0" minW="0" overflow="hidden">
          <WorkspaceChangesTab input={input} />
        </Box>
      </Box>
    </Flex>
  );
};
