import "@pstdio/ui/style.css";

import { Box, Flex } from "@chakra-ui/react";
import { defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, ChakraProvider, type Diff, DiffViewer, psTheme } from "@pstdio/ui";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface ProjectRepoDiffFile {
  change: Diff["change"];
  oldContent: string;
  newContent: string;
  oldPath: string;
  newPath: string;
  additions: number;
  deletions: number;
}

interface ProjectRepoDiffReadModel {
  changedFilePaths: string[];
  files: ProjectRepoDiffFile[];
}

interface ExtensionCommandResponse {
  outcome: {
    ok: boolean;
    reason?: string;
    status: "success" | "rejected" | "error";
    value?: unknown;
  };
}

interface ProjectFilesPageProps {
  host: GuestHost;
}

interface ProjectFilesDiffState {
  changedFilePaths: string[];
  diffs: Diff[];
  loading: boolean;
}

const commandIds = {
  read: "pstdio-core-project-repos.projectRepos.diff.read",
};

const emptyDiffState = {
  changedFilePaths: [],
  diffs: [],
  loading: false,
} satisfies ProjectFilesDiffState;

const executeCommand = async (host: GuestHost, commandId: string, params?: Record<string, unknown>) => {
  const response = await host.call<ExtensionCommandResponse>("commands.execute", { commandId, params });
  if (response.outcome.status !== "success") {
    throw new Error(response.outcome.reason ?? "Project repository command failed.");
  }
  return response.outcome.value;
};

const toDiff = (file: ProjectRepoDiffFile): Diff => ({
  change: file.change,
  oldContent: file.oldContent,
  newContent: file.newContent,
  oldPath: file.oldPath,
  newPath: file.newPath,
  additions: file.additions,
  deletions: file.deletions,
});

const readProjectRepoDiffs = async (host: GuestHost) => {
  const value = await executeCommand(host, commandIds.read);
  const model = value as ProjectRepoDiffReadModel;
  return {
    changedFilePaths: model.changedFilePaths ?? [],
    diffs: (model.files ?? []).map(toDiff),
  };
};

const ProjectFilesPage = (props: ProjectFilesPageProps) => {
  const { host } = props;
  const [error, setError] = useState<string | null>(null);
  const [diffState, setDiffState] = useState<ProjectFilesDiffState>(emptyDiffState);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setDiffState({ ...emptyDiffState, loading: true });

    void readProjectRepoDiffs(host)
      .then((nextDiffState) => {
        if (cancelled) return;
        setDiffState({ ...nextDiffState, loading: false });
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        setDiffState(emptyDiffState);
      });

    return () => {
      cancelled = true;
    };
  }, [host]);

  const defaultSelectedPath = diffState.diffs[0]?.newPath ?? diffState.diffs[0]?.oldPath;

  return (
    <Flex h="full" minH="0" minW="0" direction="column" bg="bg" color="fg" overflow="hidden">
      {error ? (
        <Box p="md">
          <AlertMessage status="error" colorPalette="red" title="Unable to load project files" size="sm">
            {error}
          </AlertMessage>
        </Box>
      ) : null}
      <Box flex="1" minH="0" minW="0" display="flex" overflow="hidden">
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

export default defineExtensionView({
  render({ mount, host }) {
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <ChakraProvider value={psTheme}>
          <ProjectFilesPage host={host} />
        </ChakraProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
