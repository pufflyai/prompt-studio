import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench";
import { dashboardQueryClient } from "@/lib/query-client";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createWorkspacesModule } from "./module";

const originalFetch = globalThis.fetch;
const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };

const workspaceResource = (metadata: Record<string, unknown> = {}): ResourceRef => ({
  kind: "workspace",
  id: "workspace-1",
  uri: "dashboard-workbench://workspace/workspace-1",
  label: "PS-118_A5",
  metadata: { workspaceId: "workspace-1", workspaceType: "worktree", ...metadata },
});

const jsonResponse = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => {
  dashboardQueryClient.clear();
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: "http://workspace-files.test" };
});

afterEach(() => {
  dashboardQueryClient.clear();
  globalThis.fetch = originalFetch;
  delete runtime.__PSTDIO_CONFIG__;
});

describe("workspace file contributions", () => {
  test("does not request files for a current-branch workspace", async () => {
    const fetchMock = mock(async () => jsonResponse({}));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const workbench = createWorkbenchCore();
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const workspace = workspaceResource({ workspaceType: "current_branch", workspaceView: "files" });

    await workbench.resources.openResource(workspace, { replaceActive: true });
    const sections = await workbench.renderers.getBody(dashboardWidgetIds.workspaceFileTree, { resource: workspace });
    const file = await workbench.renderers.getFileRenderer(dashboardWidgetIds.workspaceFileRenderer)?.load(workspace);

    expect(sections[0]?.emptyState).toEqual({
      title: "Files unavailable",
      description: "File browsing requires a worktree-backed workspace.",
    });
    expect(file?.emptyState).toEqual(sections[0]?.emptyState);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("searches, opens, loads, and saves a workspace text file through one resource", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : undefined });
      if (init?.method === "PUT") {
        return jsonResponse({
          workspace_id: "workspace-1",
          path: "README.md",
          file_name: "README.md",
          mime_type: "text/markdown",
          size: 9,
          encoding: "utf8",
          content: "# Updated",
          editable: true,
        });
      }
      if (url.includes("/file?")) {
        return jsonResponse({
          workspace_id: "workspace-1",
          path: "README.md",
          file_name: "README.md",
          mime_type: "text/markdown",
          size: 8,
          encoding: "utf8",
          content: "# Readme",
          editable: true,
        });
      }
      return jsonResponse({
        workspace_id: "workspace-1",
        path: "",
        entries: [{ path: "README.md", name: "README.md", type: "file", size: 8 }],
        truncated: false,
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const workbench = createWorkbenchCore();
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const workspace = workspaceResource({ workspaceView: "files" });

    await workbench.resources.openResource(workspace, { replaceActive: true });
    const sections = await workbench.renderers.getBody(dashboardWidgetIds.workspaceFileTree, {
      resource: workspace,
      filter: "read",
    });
    const target = sections[0]?.nodes[0]?.target;
    expect(target).toEqual(expect.objectContaining({ kind: "command" }));
    if (!target || target.kind !== "command") throw new Error("Expected a file command target.");
    await workbench.navigation.openTarget(target);

    const opened = workbench.layout
      .getLayout()
      .regions.main.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.workspaceFiles)?.resource;
    const fileRenderer = workbench.renderers.getFileRenderer(dashboardWidgetIds.workspaceFileRenderer);
    const loaded = await fileRenderer?.load(opened);
    await fileRenderer?.save?.(opened, "# Updated");

    expect(opened?.uri).toBe(workspace.uri);
    expect(opened?.metadata?.workspaceFilePath).toBe("README.md");
    expect(loaded).toEqual(expect.objectContaining({ content: "# Readme", editable: true, textRenderer: "monaco" }));
    expect(calls[0]?.url).toContain("/v1/workspaces/workspace-1/files?query=read&limit=500");
    expect(calls.some((call) => call.url.includes("/file?path=README.md") && call.method === "GET")).toBe(true);
    expect(calls.some((call) => call.method === "PUT" && call.body === '{"content":"# Updated"}')).toBe(true);
  });
});
