import { Box } from "@chakra-ui/react";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { dashboardQueryClient } from "@/lib/query-client";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  workspaceDiffFileQueryKey,
  workspaceDiffFilesQueryKey,
  workspaceFileQueryKey,
  workspaceFilesQueryKey,
} from "./data/workspace-queries";
import { createWorkspacesModule } from "./module";

const WORKSPACE_ID = "PS-118_A5";

type WorkspaceStoryState = "diffs" | "files" | "text" | "image" | "default" | "collapsed" | "remote";

const selectedPathForStory = (state: WorkspaceStoryState) => {
  if (state === "text" || state === "default" || state === "collapsed") return "README.md";
  if (state === "image") return "assets/logo.png";
  return undefined;
};

const workspaceResource = (state: WorkspaceStoryState): ResourceRef => {
  const selectedPath = selectedPathForStory(state);
  return {
    kind: "workspace",
    id: WORKSPACE_ID,
    uri: `dashboard-workbench://workspace/${WORKSPACE_ID}`,
    label: WORKSPACE_ID,
    icon: "GitBranch",
    metadata: {
      projectId: "prompt-studio",
      workspaceId: WORKSPACE_ID,
      workspaceShorthand: WORKSPACE_ID,
      workspaceType: state === "default" || state === "remote" ? "current_branch" : "worktree",
      workspaceView: state === "diffs" ? "diffs" : "files",
      ...(state === "remote"
        ? {
            workspaceExecutionKind: "remote",
            workspaceSupportsFiles: false,
            workspaceSupportsDiff: false,
          }
        : {}),
      ...(selectedPath ? { workspaceFilePath: selectedPath } : {}),
    },
  };
};

const seedWorkspaceQueries = () => {
  dashboardQueryClient.clear();
  dashboardQueryClient.setQueryDefaults(["workspace-files", WORKSPACE_ID], { staleTime: Number.POSITIVE_INFINITY });
  dashboardQueryClient.setQueryDefaults(["workspace-diffs", WORKSPACE_ID], { staleTime: Number.POSITIVE_INFINITY });
  dashboardQueryClient.setQueryData(workspaceFilesQueryKey(WORKSPACE_ID, { limit: 500 }), {
    workspace_id: WORKSPACE_ID,
    path: "",
    entries: [
      { path: "src", name: "src", type: "directory" as const },
      { path: "assets", name: "assets", type: "directory" as const },
      { path: "README.md", name: "README.md", type: "file" as const, size: 485 },
    ],
    truncated: false,
  });
  dashboardQueryClient.setQueryData(workspaceFileQueryKey(WORKSPACE_ID, "README.md"), {
    workspace_id: WORKSPACE_ID,
    path: "README.md",
    file_name: "README.md",
    mime_type: "text/markdown",
    size: 485,
    encoding: "utf8" as const,
    content: [
      "# Prompt Studio",
      "",
      "A workspace keeps its Files and Changes views on the same resource.",
      "",
      "## PS-118",
      "",
      "- Browse files from the left Panel menu.",
      "- Edit text with Monaco.",
      "- Load one diff body when it is selected.",
    ].join("\n"),
    editable: true,
  });
  dashboardQueryClient.setQueryData(workspaceFileQueryKey(WORKSPACE_ID, "assets/logo.png"), {
    workspace_id: WORKSPACE_ID,
    path: "assets/logo.png",
    file_name: "logo.png",
    mime_type: "image/png",
    size: 68,
    encoding: "base64" as const,
    data_url:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    editable: false,
  });
  const readmeDiff = {
    filePath: "README.md",
    change: "modified" as const,
    additions: 4,
    deletions: 1,
    oldPath: "README.md",
    newPath: "README.md",
  };
  for (const mode of ["current", "fork_point"] as const) {
    dashboardQueryClient.setQueryData(workspaceDiffFilesQueryKey(WORKSPACE_ID, mode), {
      workspace_id: WORKSPACE_ID,
      files: [readmeDiff],
    });
    dashboardQueryClient.setQueryData(workspaceDiffFileQueryKey(WORKSPACE_ID, mode, "README.md"), {
      ...readmeDiff,
      oldContent: "# Prompt Studio\n\nThe old workspace diff view.\n",
      newContent: "# Prompt Studio\n\nFiles and Changes are workspace tabs.\n\nText opens in Monaco.\n",
    });
  }
};

const createStoryWorkbench = (state: WorkspaceStoryState) => {
  seedWorkspaceQueries();
  const workbench = createWorkbenchCore();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: "prompt-studio", name: "Prompt Studio" });
  void workbench.resources.openResource(workspaceResource(state), { replaceActive: true }).then(() => {
    workbench.panels.setOpen("sidenav", false);
    if (state !== "collapsed") return;
    const fileMenu = workbench.layout
      .listPanelInstances("main-left-menu")
      .find((panel) => panel.panelId === dashboardWidgetIds.workspaceFileTree);
    if (fileMenu) workbench.panels.setOpen(`panel-menu:${fileMenu.instanceId}`, false);
  });
  return workbench;
};

const WorkspaceFilesStory = (props: { state: WorkspaceStoryState }) => {
  const { state } = props;
  const [workbench] = useState(() => createStoryWorkbench(state));
  return (
    <QueryClientProvider client={dashboardQueryClient}>
      <Box h="100dvh" w="full">
        <Workbench workbench={workbench} />
      </Box>
    </QueryClientProvider>
  );
};

const meta = {
  title: "Modules/Workspaces/Files and Changes",
  component: WorkspaceFilesStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkspaceFilesStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ChangesSelected: Story = { args: { state: "diffs" } };

export const FilesNoSelection: Story = { args: { state: "files" } };

export const MonacoTextFile: Story = { args: { state: "text" } };

export const ImagePreview: Story = { args: { state: "image" } };

export const DefaultWorkspace: Story = { args: { state: "default" } };

export const CollapsedFilesMenu: Story = { args: { state: "collapsed" } };

export const RemoteWithoutFileViews: Story = { args: { state: "remote" } };
