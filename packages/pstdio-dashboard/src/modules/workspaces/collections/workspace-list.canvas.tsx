import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../module";
import { seedWorkspaceViewsStory } from "./workspace-views-story";

const PROJECT_ID = "storybook-workspace-list";
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const workspaceRow = (
  row: {
    id: string;
  } & Record<string, unknown>,
) => ({
  project_id: PROJECT_ID,
  archived: false,
  setup_error: null,
  deleted_at: null,
  provider_state: "ready",
  execution_kind: "local",
  branch: null,
  updated_at: hoursAgo(1),
  ...row,
});
const seedWorkspaces = () =>
  getWriter("workspaces")?.truncateAndWrite([
    workspaceRow({
      id: "workspace-folder",
      name: "Project workspace",
      workspace_shorthand: "WS-1",
      provider_id: "pstdio.root",
      is_default: true,
      root_path: "/Users/alex/Projects/prompt-studio",
      provider_capabilities_json: { files: "write", diff: false },
      created_at: hoursAgo(72),
    }),
    workspaceRow({
      id: "workspace-worktree",
      name: "Workspace list defaults",
      workspace_shorthand: "PS-400_A1",
      provider_id: "pstdio.worktree",
      branch: "workspace/PS-400_A1",
      root_path: "/Users/alex/.pstdio/workspaces/5c64c4e9-82c0-4be1-989a-4eb1b95d9345/prompt-studio",
      provider_capabilities_json: { files: "write", diff: true, merge: true },
      created_at: hoursAgo(5),
    }),
    workspaceRow({
      id: "workspace-remote",
      name: "Remote runner",
      workspace_shorthand: "WS-3",
      provider_id: "example.remote-execution.workspace-type.remote",
      execution_kind: "remote",
      provider_state: "failed",
      display_path: "remote://runner-42/workspace",
      provider_error_json: { message: "Remote container failed to start" },
      provider_capabilities_json: { files: "read", diff: false },
      created_at: hoursAgo(2),
    }),
  ]);
// Storybook has no API server. Only diff summaries are answered, and only while the story is mounted.
const useDiffSummaryResponses = () => {
  useEffect(() => {
    const originalFetch = globalThis.fetch;
    const answerDiffSummaries = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const match = url.match(/\/v1\/workspaces\/([^/]+)\/diff-summary/);
      if (!match) return originalFetch(input, init);
      return Response.json({ workspace_id: match[1], additions: 128, deletions: 14, file_count: 6 });
    };
    globalThis.fetch = Object.assign(answerDiffSummaries, originalFetch);
    return () => {
      globalThis.fetch = originalFetch;
    };
  }, []);
};
interface WorkspaceListStoryProps {
  openWorkspaceId?: string;
}
const WorkspaceListStory = (props: WorkspaceListStoryProps) => {
  const { openWorkspaceId } = props;
  useDiffSummaryResponses();
  const [workbench] = useState(() => {
    seedWorkspaces();
    seedWorkspaceViewsStory(PROJECT_ID);
    const next = createWorkbench();
    next.registerModule(createWorkspacesModule());
    selectDashboardProject(next, { id: PROJECT_ID, name: "Prompt Studio" });
    // Tool sidebars link workspaces by identity only, so the host must supply the icon.
    openWorkspacesPage(next, openWorkspaceId ? { type: "workspace", id: openWorkspaceId } : undefined);
    return next;
  });
  return (
    <QueryClientProvider client={getDashboardQueryClient()}>
      <Box h="100dvh">
        <Workbench workbench={workbench} />
      </Box>
    </QueryClientProvider>
  );
};
const meta = {
  title: "Dashboard/Workspace list",
  component: WorkspaceListStory,
  parameters: { layout: "fullscreen" },
} satisfies CanvasMeta<typeof WorkspaceListStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Defaults: Story = {
  id: "dashboard-workspace-list--defaults",
};
export const DiagnosticColumns: Story = {
  id: "dashboard-workspace-list--diagnostic-columns",
};
export const ProjectFolderBreadcrumb: Story = {
  id: "dashboard-workspace-list--project-folder-breadcrumb",
  args: { openWorkspaceId: "workspace-folder" },
};
export const GitWorktreeBreadcrumb: Story = {
  id: "dashboard-workspace-list--git-worktree-breadcrumb",
  args: { openWorkspaceId: "workspace-worktree" },
};
