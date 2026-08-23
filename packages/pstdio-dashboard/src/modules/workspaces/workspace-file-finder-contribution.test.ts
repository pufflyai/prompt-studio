import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench";
import { dashboardQueryClient } from "@/lib/query-client";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createWorkspacesModule } from "./module";

const originalFetch = globalThis.fetch;
const runtime = globalThis as typeof globalThis & {
  __PSTDIO_CONFIG__?: { apiBaseUrl?: string };
  promptStudioDesktop?: {
    getAppInfo(): Promise<{ platform: string }>;
    revealInFinder(path: string): Promise<void>;
  };
};

const workspace: ResourceRef = {
  kind: "workspace",
  id: "workspace-1",
  uri: "dashboard-workbench://workspace/workspace-1",
  label: "PS-118_A5",
  metadata: {
    workspaceId: "workspace-1",
    workspaceType: "worktree",
    workspacePath: "/repo/worktree",
    workspaceView: "files",
  },
};

beforeEach(() => {
  dashboardQueryClient.clear();
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: "http://workspace-finder.test" };
});

afterEach(() => {
  dashboardQueryClient.clear();
  globalThis.fetch = originalFetch;
  delete runtime.__PSTDIO_CONFIG__;
  delete runtime.promptStudioDesktop;
});

test("offers Finder reveal only through the macOS desktop bridge", async () => {
  const revealedPaths: string[] = [];
  runtime.promptStudioDesktop = {
    getAppInfo: async () => ({ platform: "darwin" }),
    revealInFinder: async (path) => {
      revealedPaths.push(path);
    },
  };
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    if (String(input).includes("/diff-files?")) {
      return Response.json({ workspace_id: "workspace-1", files: [] });
    }
    return Response.json({
      workspace_id: "workspace-1",
      path: "",
      entries: [{ path: "README.md", name: "README.md", type: "file", size: 8 }],
      truncated: false,
    });
  }) as unknown as typeof fetch;
  const workbench = createWorkbenchCore();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

  const sections = await workbench.renderers.getBody(dashboardWidgetIds.workspaceFileTree, { resource: workspace });
  const reveal = sections[0]?.nodes[0]?.contextMenuActions?.find((action) => action.id === "workspace-entry.reveal");
  await reveal?.run?.();

  expect(reveal?.label).toBe("Reveal in Finder");
  expect(revealedPaths).toEqual(["/repo/worktree/README.md"]);
});
