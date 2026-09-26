import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardQueryClient } from "@/lib/query-client";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { fileViewBody, treeViewSections } from "@/shared/workbench/workbench-view-test-helpers";
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
      if (url.pathname.endsWith("/file")) {
        return Response.json({
          workspace_id: "readiness-workspace",
          path: "notes.md",
          file_name: "notes.md",
          mime_type: "text/markdown",
          encoding: "utf8",
          content: "Workspace notes",
          editable: true,
        });
      }
      if (url.pathname.endsWith("/files")) {
        return Response.json({
          workspace_id: "readiness-workspace",
          path: "",
          entries: [{ path: "notes.md", name: "notes.md", type: "file", size: 8 }],
          truncated: false,
        });
      }
      return Response.json({ workspace_id: "readiness-workspace", files: [] });
    },
  });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.toString() };
});

afterEach(() => {
  getWriter("workspaces")?.remove("readiness-workspace");
  dashboardQueryClient.clear();
  server.stop(true);
  delete runtime.__PSTDIO_CONFIG__;
});

const createFixture = () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: "readiness-project", name: "Readiness" });
  openWorkspacesPage(workbench, {
    type: "workspace",
    id: "readiness-workspace",
    metadata: { workspaceType: "worktree", workspaceView: "files", workspaceSupportsDiff: true },
  });
  const load = () =>
    treeViewSections(workbench, dashboardWidgetIds.workspaceFileTree, { resource: workbench.getPrimaryResource() });
  const row = {
    id: "readiness-workspace",
    project_id: "readiness-project",
    provider_id: "pstdio.worktree",
    execution_kind: "local",
    provider_state: "ready",
    provider_capabilities_json: { files: "write", diff: true },
    worktree_path: "/project",
    setup_error: null,
    provider_error_json: null,
  };
  return { workbench, load, row, writer: getWriter("workspaces")! };
};

describe("workspace file readiness", () => {
  test.each([
    "unknown",
    "provisioning",
    "failed",
    "provider_missing",
  ])("defers requests while %s and loads after workspace sync becomes ready", async (state) => {
    const { workbench, load, row, writer } = createFixture();
    if (state === "provisioning") writer.upsert({ ...row, initializing: true });
    else if (state !== "unknown") writer.upsert({ ...row, provider_state: state });

    await load();
    expect(requests).toEqual([]);

    writer.upsert({ ...row, initializing: false });
    expect(workbench.getPrimaryResource()?.metadata?.workspaceProviderState).toBe("ready");
    const sections = await load();

    expect(sections[0]?.nodes[0]?.id).toBe("notes.md");
    expect([...requests].sort()).toEqual([
      "/v1/workspaces/readiness-workspace/diff-files?mode=fork_point",
      "/v1/workspaces/readiness-workspace/files?limit=500",
    ]);
  });

  test.each([
    "unknown",
    "provisioning",
    "failed",
    "provider_missing",
  ])("defers selected-file reads while %s and reads after readiness sync", async (state) => {
    const { workbench, row, writer } = createFixture();
    openWorkspacesPage(workbench, {
      type: "workspace",
      id: row.id,
      metadata: { workspaceView: "files", workspaceFilePath: "notes.md" },
    });
    if (state === "provisioning") writer.upsert({ ...row, initializing: true });
    else if (state !== "unknown") writer.upsert({ ...row, provider_state: state });
    const loadFile = () =>
      fileViewBody(workbench, dashboardWidgetIds.workspaceFiles).load(
        workbench.getPrimaryResource(),
        new AbortController().signal,
      );

    await loadFile();
    expect(requests).toEqual([]);

    writer.upsert({ ...row, initializing: false });
    expect(await loadFile()).toMatchObject({ filePath: "notes.md", content: "Workspace notes" });
    expect(requests).toEqual(["/v1/workspaces/readiness-workspace/file?path=notes.md"]);
  });

  test.each([
    "setup",
    "provider",
  ])("reports a %s failure before requesting files or waiting for readiness", async (source) => {
    const { workbench, load, row, writer } = createFixture();
    const message = "Workspace setup could not finish.";
    writer.upsert({
      ...row,
      initializing: true,
      setup_error: source === "setup" ? message : null,
      provider_error_json: source === "provider" ? { message } : null,
    });

    await expect(load()).rejects.toThrow(message);
    await expect(
      fileViewBody(workbench, dashboardWidgetIds.workspaceFiles).load(
        {
          ...workbench.getPrimaryResource()!,
          metadata: { ...workbench.getPrimaryResource()?.metadata, workspaceFilePath: "notes.md" },
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow(message);
    expect(requests).toEqual([]);

    writer.upsert({ ...row, initializing: false });
    const sections = await load();
    expect(sections[0]?.nodes[0]?.id).toBe("notes.md");
    expect(requests).toHaveLength(2);
  });
});
