import { Box, Center, Flex, Text } from "@chakra-ui/react";
import { resolveFileIconElement, useFileIconThemePreference } from "@pstdio/ui";
import { type Diff, DiffViewer } from "@pstdio/ui/diff";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type WorkspaceDiffMode,
  type WorkspaceDiffSummaryFile,
  workspaceDiffFilePath,
  workspaceDiffFileQueryOptions,
  workspaceDiffFilesQueryOptions,
} from "../data/workspace-queries";
import { resolveWorkspaceDiffRequest } from "./workspace-widget-state";

const toDiff = (summary: WorkspaceDiffSummaryFile, body?: WorkspaceDiffSummaryFile | null): Diff => ({
  change: summary.change,
  oldPath: summary.oldPath ?? summary.filePath,
  newPath: summary.newPath ?? summary.filePath,
  additions: summary.additions,
  deletions: summary.deletions,
  ...(body ? { oldContent: body.oldContent ?? "", newContent: body.newContent ?? "" } : {}),
});

const useWorkspaceDiffs = (request: { workspaceId: string; mode: WorkspaceDiffMode } | undefined) => {
  const queryClient = useQueryClient();
  const [requested, setRequested] = useState<{ requestKey?: string; paths: string[] }>({ paths: [] });
  const workspaceId = request?.workspaceId;
  const mode = request?.mode ?? "fork_point";
  const requestKey = request ? `${request.workspaceId}:${request.mode}` : undefined;
  const requestedPaths = requested.requestKey === requestKey ? requested.paths : [];
  const summary = useQuery({
    ...workspaceDiffFilesQueryOptions(workspaceId ?? "", mode),
    enabled: Boolean(workspaceId),
  });
  const bodyQueries = useQueries({
    queries: workspaceId ? requestedPaths.map((path) => workspaceDiffFileQueryOptions(workspaceId, mode, path)) : [],
  });

  const bodiesByPath = new Map(
    bodyQueries
      .map((query) => query.data)
      .filter((body): body is WorkspaceDiffSummaryFile => Boolean(body))
      .map((body) => [workspaceDiffFilePath(body), body]),
  );
  const files = summary.data?.files ?? [];

  return {
    diffs: files.map((file) => toDiff(file, bodiesByPath.get(workspaceDiffFilePath(file)))),
    paths: files.map(workspaceDiffFilePath),
    loading: summary.isLoading,
    error: summary.error,
    loadDiff: async (path: string) => {
      if (!workspaceId) return;
      setRequested((current) => {
        const paths = current.requestKey === requestKey ? current.paths : [];
        return { requestKey, paths: paths.includes(path) ? paths : [...paths, path] };
      });
      await queryClient.fetchQuery(workspaceDiffFileQueryOptions(workspaceId, mode, path));
    },
  };
};

export const WorkspaceDiffsPanel = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const request = resolveWorkspaceDiffRequest({
    resourceId: input.instance.resource?.id,
    metadata: input.instance.resource?.metadata,
  });
  const { diffs, paths, loading, error, loadDiff } = useWorkspaceDiffs(request);
  const { activeFileIconTheme } = useFileIconThemePreference();

  if (error) {
    return (
      <Center h="full" minH="0" bg="bg" p="md">
        <Text color="fg.error">{error instanceof Error ? error.message : "Failed to load workspace changes."}</Text>
      </Center>
    );
  }

  const resolveFileIcon = (path: string) => {
    const fileName = path.split("/").pop() ?? path;
    return { icon: resolveFileIconElement(fileName, { theme: activeFileIconTheme }), color: "fg.subtle" };
  };

  return (
    <Flex direction="column" h="full" minH="0" minW="0" bg="bg">
      <Box position="relative" flex="1" minH="0" minW="0">
        <Box position="absolute" inset="0" display="flex" minH="0" minW="0" overflow="hidden">
          <DiffViewer
            diffs={diffs}
            changedFilePaths={paths}
            defaultSelectedPath={paths[0]}
            loading={loading}
            onLoadDiff={loadDiff}
            resolveFileIcon={resolveFileIcon}
          />
        </Box>
      </Box>
    </Flex>
  );
};
