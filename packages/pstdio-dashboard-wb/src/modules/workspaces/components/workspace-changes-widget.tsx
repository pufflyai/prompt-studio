import { Box, Flex } from "@chakra-ui/react";
import { type Diff, DiffViewer } from "@pstdio/ui";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  collectWorkspaceChangedFilePaths,
  type DashboardWorkspaceDiffResponse,
  transformWorkspaceFileDiffs,
} from "../data/workspace-review-data";

interface WorkspaceDiffState {
  diffs: Diff[];
  changedFilePaths: string[];
  loading: boolean;
}

const emptyDiffState: WorkspaceDiffState = {
  diffs: [],
  changedFilePaths: [],
  loading: false,
};

const loadDashboardWorkspaceDiff = async (workspaceId: string, signal: AbortSignal) => {
  const data = await apiRequest<DashboardWorkspaceDiffResponse>(`/v1/workspaces/${workspaceId}/diff?mode=fork_point`, {
    signal,
  });

  return {
    diffs: transformWorkspaceFileDiffs(data.files),
    changedFilePaths: collectWorkspaceChangedFilePaths(data.files),
  };
};

export const WorkspaceChangesWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const workspaceId = input.placement.resource?.id;
  const [diffState, setDiffState] = useState<WorkspaceDiffState>(emptyDiffState);

  useEffect(() => {
    if (!workspaceId) {
      setDiffState(emptyDiffState);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setDiffState({ ...emptyDiffState, loading: true });

    void loadDashboardWorkspaceDiff(workspaceId, controller.signal)
      .then((nextDiffState) => {
        if (cancelled) return;
        setDiffState({ ...nextDiffState, loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setDiffState(emptyDiffState);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [workspaceId]);

  const defaultSelectedPath = diffState.diffs[0]?.newPath ?? diffState.diffs[0]?.oldPath;

  return (
    <Flex h="full" minH="0" minW="0" direction="column" position="relative" overflow="hidden">
      <Box position="absolute" inset="0" display="flex" minH="0" minW="0" overflow="hidden">
        <DiffViewer
          diffs={diffState.diffs}
          changedFilePaths={diffState.changedFilePaths}
          defaultSelectedPath={defaultSelectedPath}
          loading={diffState.loading}
        />
      </Box>
    </Flex>
  );
};
