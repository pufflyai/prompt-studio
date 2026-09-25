import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createWorkbench, type ResourceRef } from "@pstdio/workbench";
import { dashboardQueryClient } from "@/lib/query-client";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { treeViewSections } from "@/shared/workbench/workbench-view-test-helpers";
import { createWorkspacesModule } from "./module";

const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
let server: ReturnType<typeof Bun.serve>;
let requests: string[];

beforeEach(() => {
  dashboardQueryClient.clear();
  requests = [];
  server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const url = new URL(request.url);
      requests.push(url.pathname + url.search);
      if (url.pathname.endsWith("/files")) {
        return Response.json({
          workspace_id: "workspace-1",
          path: "",
          entries: [{ path: "notes.md", name: "notes.md", type: "file", size: 8 }],
          truncated: false,
        });
      }
      return Response.json({ error: "Workspace does not support diffs." }, { status: 400 });
    },
  });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.toString() };
});

afterEach(() => {
  dashboardQueryClient.clear();
  server.stop(true);
  delete runtime.__PSTDIO_CONFIG__;
});

const loadFiles = (metadata: Record<string, unknown>) => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Notes" });
  const resource: ResourceRef = {
    type: "workspace",
    id: "workspace-1",
    metadata: { workspaceId: "workspace-1", workspaceType: "folder", ...metadata },
  };
  return treeViewSections(workbench, dashboardWidgetIds.workspaceFileTree, { resource });
};

describe("workspace file loading", () => {
  test.each([false, undefined])("loads folder files when diff capability is %s", async (workspaceSupportsDiff) => {
    const sections = await loadFiles({ workspaceSupportsDiff });

    expect(sections[0]?.nodes).toEqual([
      expect.objectContaining({ id: "notes.md", label: "notes.md", endContent: undefined }),
    ]);
    expect(requests).toEqual(["/v1/workspaces/workspace-1/files?limit=500"]);
  });

  test("reports a workspace setup error before loading its files", async () => {
    const workspaceError = "The selected folder does not exist at the chosen Git revision.";

    await expect(loadFiles({ workspaceType: "worktree", workspaceSupportsDiff: true, workspaceError })).rejects.toThrow(
      workspaceError,
    );
    expect(requests).toEqual([]);
  });

  test.each(["setup", "provider"])("loads files when an open workspace recovers from a %s error", async (source) => {
    const writer = getWriter("workspaces")!;
    const workspaceError = "Workspace initialization failed.";
    const row = {
      id: "workspace-1",
      project_id: "recovery-project",
      provider_id: "pstdio.root",
      execution_kind: "local",
      provider_state: "failed",
      provider_capabilities_json: { files: "write", diff: false },
      root_path: null,
      setup_error: source === "setup" ? workspaceError : null,
      provider_error_json: source === "provider" ? { message: workspaceError } : null,
    };
    writer.upsert(row);
    const workbench = createWorkbench();
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: row.project_id, name: "Recovery" });
    openWorkspacesPage(workbench, {
      type: "workspace",
      id: row.id,
      metadata: { workspaceView: "files", workspaceFilePath: "notes.md" },
    });
    const loadOpenFiles = () =>
      treeViewSections(workbench, dashboardWidgetIds.workspaceFileTree, {
        resource: workbench.getPrimaryResource(),
      });

    try {
      await expect(loadOpenFiles()).rejects.toThrow(workspaceError);
      expect(requests).toEqual([]);
      writer.upsert({
        ...row,
        provider_state: "ready",
        root_path: "/project",
        setup_error: null,
        provider_error_json: null,
      });

      const sections = await loadOpenFiles();
      expect(sections[0]?.nodes[0]?.id).toBe("notes.md");
      expect(workbench.getPrimaryResource()?.metadata).toMatchObject({
        workspaceProviderState: "ready",
        workspaceView: "files",
        workspaceFilePath: "notes.md",
      });
      expect(requests).toEqual(["/v1/workspaces/workspace-1/files?limit=500"]);
    } finally {
      writer.remove(row.id);
    }
  });
});
