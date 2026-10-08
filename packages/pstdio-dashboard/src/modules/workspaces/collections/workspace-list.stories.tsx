import { Box } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { dashboardQueryClient } from "@/lib/query-client";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../module";
import { seedWorkspaceViewsStory } from "./workspace-views-story";

const PROJECT_ID = "storybook-workspace-list";
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const workspaceRow = (row: { id: string } & Record<string, unknown>) => ({
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
    <QueryClientProvider client={dashboardQueryClient}>
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
} satisfies Meta<typeof WorkspaceListStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const columnHeaders = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll("thead tr.data-table-column-header-row th")]
    .map((cell) => cell.textContent?.trim())
    .filter(Boolean);

export const Defaults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Workspace list defaults");
    await expect(columnHeaders(canvasElement)).toEqual(["Name", "Type", "Location", "Created at", "Diff"]);
    await expect(canvas.queryByText("unique values")).toBeNull();
    await expect(canvas.getByText("Git worktree")).toBeVisible();
    await expect(canvas.getAllByText("Not supported")).toHaveLength(2);
    await waitFor(() => expect(canvas.getByText("+128")).toBeVisible());
  },
};

export const DiagnosticColumns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Remote runner");
    await userEvent.click(canvas.getByRole("button", { name: "Display settings" }));
    const menu = within(await within(document.body).findByRole("dialog"));
    await userEvent.click(menu.getByText("Statistics"));
    await userEvent.click(menu.getByText("State", { exact: true }));
    await userEvent.click(menu.getByText("Provider error"));
    await expect(await canvas.findByText("Remote container failed to start")).toBeVisible();
    await expect(canvas.getByRole("cell", { name: "Failed" })).toBeVisible();
    await expect((await canvas.findAllByText("unique values")).length).toBeGreaterThan(0);
  },
};

const breadcrumbLeafIcon = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('nav[aria-label="breadcrumb"] li:last-child svg')?.getAttribute("class") ?? "";

export const ProjectFolderBreadcrumb: Story = {
  args: { openWorkspaceId: "workspace-folder" },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(breadcrumbLeafIcon(canvasElement)).toContain("lucide-folder"));
  },
};

export const GitWorktreeBreadcrumb: Story = {
  args: { openWorkspaceId: "workspace-worktree" },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(breadcrumbLeafIcon(canvasElement)).toContain("lucide-git-branch"));
  },
};
