import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef, type TreeNode } from "@pstdio/workbench";
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
let apiBaseUrlId = 0;

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
  apiBaseUrlId += 1;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: `http://workspace-files-${apiBaseUrlId}.test` };
});

afterEach(() => {
  dashboardQueryClient.clear();
  globalThis.fetch = originalFetch;
  delete runtime.__PSTDIO_CONFIG__;
  delete runtime.promptStudioDesktop;
});

describe("workspace file contributions", () => {
  test("loads files for a current-branch workspace through the API", async () => {
    const fetchMock = mock(async (input: string | URL | Request) => {
      if (String(input).includes("/diff-files?")) {
        return jsonResponse({
          workspace_id: "workspace-1",
          files: [{ filePath: "README.md", change: "modified", additions: 1, deletions: 0 }],
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
    const workspace = workspaceResource({ workspaceType: "current_branch", workspaceView: "files" });

    const sections = await workbench.renderers.getBody(dashboardWidgetIds.workspaceFileTree, { resource: workspace });
    const file = await workbench.renderers.getFileRenderer(dashboardWidgetIds.workspaceFileRenderer)?.load(workspace);

    expect(sections[0]?.nodes).toEqual([
      expect.objectContaining({
        id: "README.md",
        label: "README.md",
        endContent: expect.objectContaining({ props: { change: "modified" } }),
      }),
    ]);
    expect(file?.emptyState).toEqual({
      title: "Select a file",
      description: "Choose a file from the Files panel.",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v1/workspaces/workspace-1/files?limit=500");
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/diff-files?mode=current"))).toBe(true);
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
      if (url.includes("/diff-files?")) return jsonResponse({ workspace_id: "workspace-1", files: [] });
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
    const fileRendererRefreshes: string[] = [];
    const refreshSubscription = workbench.renderers.onDidRefreshFileRenderer((event) => {
      fileRendererRefreshes.push(event.fileRendererId);
    });
    const loaded = await fileRenderer?.load(opened);
    await fileRenderer?.save?.(opened, "# Updated");
    refreshSubscription.dispose();

    expect(opened?.uri).toBe(workspace.uri);
    expect(opened?.metadata?.workspaceFilePath).toBe("README.md");
    expect(loaded).toEqual(
      expect.objectContaining({ filePath: "README.md", content: "# Readme", editable: true, textRenderer: "monaco" }),
    );
    expect(calls[0]?.url).toContain("/v1/workspaces/workspace-1/files?query=read&limit=500");
    expect(calls.some((call) => call.url.includes("/file?path=README.md") && call.method === "GET")).toBe(true);
    expect(calls.some((call) => call.method === "PUT" && call.body === '{"content":"# Updated"}')).toBe(true);
    expect(fileRendererRefreshes).toEqual([]);
  });

  test("creates inline and keeps file and folder operations in their context menus", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : undefined });
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            workspace_id: "workspace-1",
            path: "notes.md",
            file_name: "notes.md",
            mime_type: "text/markdown",
            size: 0,
            encoding: "utf8",
            content: "",
            editable: true,
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/diff-files?")) {
        return jsonResponse({
          workspace_id: "workspace-1",
          files: [{ filePath: "README.md", change: "modified", additions: 1, deletions: 0 }],
        });
      }
      return jsonResponse({
        workspace_id: "workspace-1",
        path: "",
        entries: [
          { path: "docs", name: "docs", type: "directory" },
          { path: "README.md", name: "README.md", type: "file", size: 8 },
        ],
        truncated: false,
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const workbench = createWorkbenchCore();
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const workspace = workspaceResource({ workspaceView: "files" });
    await workbench.resources.openResource(workspace, { replaceActive: true });

    const sections = await workbench.renderers.getBody(dashboardWidgetIds.workspaceFileTree, { resource: workspace });
    const createAction = sections[0]?.actions?.find((action) => action.id === "workspace-file.create");
    expect(createAction?.params).toBeUndefined();
    await createAction?.run?.();
    expect(calls.some((call) => call.method === "POST")).toBe(false);

    const creatingSections = await workbench.renderers.getBody(dashboardWidgetIds.workspaceFileTree, {
      resource: workspace,
    });
    const inlineNode = creatingSections[0]?.nodes.find((node) => node.id === "workspace-file:new:root") as
      | (TreeNode & { inlineInput?: { onCommit(value: string): Promise<void> | void } })
      | undefined;
    expect(inlineNode?.inlineInput).toEqual(expect.objectContaining({ ariaLabel: "New file name" }));
    await inlineNode?.inlineInput?.onCommit("notes.md");

    const opened = workbench.layout
      .getLayout()
      .regions.main.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.workspaceFiles)?.resource;
    expect(opened?.metadata?.workspaceFilePath).toBe("notes.md");
    expect(calls).toContainEqual(expect.objectContaining({ method: "POST", body: '{"content":""}' }));

    const folder = sections[0]?.nodes.find((node) => node.id === "docs");
    expect(folder?.iconElement).toBeUndefined();
    expect(folder?.actions).toBeUndefined();
    expect(folder?.contextMenuActions?.map((action) => action.label)).toEqual([
      "New file",
      "Copy path",
      "Copy relative path",
      "Delete folder",
    ]);

    const file = sections[0]?.nodes.find((node) => node.id === "README.md");
    expect(file?.iconElement).toBeDefined();
    expect(file?.endContent).toMatchObject({ props: { change: "modified" } });
    expect(file?.actions).toBeUndefined();
    expect(file?.contextMenuActions?.map((action) => action.label)).toEqual([
      "Copy path",
      "Copy relative path",
      "Delete file",
    ]);
    expect((file as (TreeNode & { showContextMenuTrigger?: boolean }) | undefined)?.showContextMenuTrigger).toBe(false);

    const deleteAction = file?.contextMenuActions?.find((action) => action.id === "workspace-entry.delete");
    await deleteAction?.run?.();
    const confirmation = workbench.layout
      .getLayout()
      .regions.overlay.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.deleteWorkspaceEntry);
    expect(confirmation?.resource?.metadata?.workspaceDeletePath).toBe("README.md");
    expect(confirmation?.resource?.metadata?.workspaceDeleteType).toBe("file");

    await folder?.contextMenuActions?.find((action) => action.id === "workspace-entry.delete")?.run?.();
    const folderConfirmation = workbench.layout
      .getLayout()
      .regions.overlay.widgets.find(
        (widget) =>
          widget.contributionId === dashboardWidgetIds.deleteWorkspaceEntry &&
          widget.resource?.metadata?.workspaceDeleteType === "directory",
      );
    expect(folderConfirmation?.resource?.metadata?.workspaceDeletePath).toBe("docs");
  });
});

describe("workspace Finder action", () => {
  test("offers Finder reveal only through the macOS desktop bridge", async () => {
    const revealedPaths: string[] = [];
    runtime.promptStudioDesktop = {
      getAppInfo: async () => ({ platform: "darwin" }),
      revealInFinder: async (path) => {
        revealedPaths.push(path);
      },
    };
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      if (String(input).includes("/diff-files?")) return jsonResponse({ workspace_id: "workspace-1", files: [] });
      return jsonResponse({
        workspace_id: "workspace-1",
        path: "",
        entries: [{ path: "README.md", name: "README.md", type: "file", size: 8 }],
        truncated: false,
      });
    }) as unknown as typeof fetch;
    const workbench = createWorkbenchCore();
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const workspace = workspaceResource({ workspacePath: "/repo/worktree", workspaceView: "files" });

    const sections = await workbench.renderers.getBody(dashboardWidgetIds.workspaceFileTree, { resource: workspace });
    const reveal = sections[0]?.nodes[0]?.contextMenuActions?.find((action) => action.id === "workspace-entry.reveal");
    await reveal?.run?.();

    expect(reveal?.label).toBe("Reveal in Finder");
    expect(revealedPaths).toEqual(["/repo/worktree/README.md"]);
  });
});
