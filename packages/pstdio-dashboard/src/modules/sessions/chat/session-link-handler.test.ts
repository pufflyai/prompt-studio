import { expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { parsePageUrl } from "pstdio-api-contracts";
import { getDashboardQueryClient } from "@/lib/query-client";
import { selectDashboardProject } from "@/shared/app/project-context";
import { buildDashboardWorkspaceOptionsFromRows } from "@/shared/workspaces/workspace-options";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionLinkHandler } from "./session-link-handler";

const projectId = "chat-link-project";

const workspace = (id: string) =>
  buildDashboardWorkspaceOptionsFromRows(
    {
      workspaces: [
        {
          id,
          project_id: projectId,
          name: id,
          workspace_shorthand: id,
          root_path: `/repo/${id}`,
          execution_kind: "local",
          provider_state: "ready",
          provider_capabilities_json: { files: "write" },
        },
      ],
    },
    projectId,
  )[0];

const projectWorkbench = () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: projectId, name: "Chat links" });
  workbench.pageLocations.setProject(projectId);
  return workbench;
};

test("chat paths become resources only when the session workspace has the file", async () => {
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
  const folders: Record<string, { files: string[]; truncated?: boolean }> = {
    "": { files: ["README.md"] },
    src: { files: ["src/app.ts"] },
    large: { files: [], truncated: true },
  };
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const url = new URL(request.url);
      const path = url.searchParams.get("path") ?? "";
      requests.push(`${url.pathname.split("/").pop()} ${path}`);
      if (url.pathname.endsWith("/workspaces/workspace-a/file"))
        return path === "large/big.ts"
          ? Response.json({ error: "Workspace file is too large" }, { status: 413 })
          : Response.json({ error: "Workspace file not found" }, { status: 404 });
      const folder = folders[path];
      if (!url.pathname.endsWith("/workspaces/workspace-a/files") || !folder)
        return Response.json({ error: "Workspace directory not found" }, { status: 404 });
      return Response.json({
        workspace_id: "workspace-a",
        path,
        entries: folder.files.map((file) => ({ path: file, name: file.split("/").pop(), type: "file" })),
        truncated: folder.truncated ?? false,
      });
    },
  });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.toString() };
  try {
    const workbench = projectWorkbench();
    const handler = createSessionLinkHandler({
      workbench,
      projectId,
      workspace: workspace("workspace-a"),
      origin: "http://local",
      onError: () => {},
    });
    const resolve = (source: string, origin: "text" | "inline-code" | "markdown") =>
      handler.resolveResource!({ source, origin });

    const href = handler.resolveHref({ source: "src/app.ts:12", origin: "inline-code" });
    expect(href).toContain("workspace");
    expect(await resolve("src/app.ts:12", "inline-code")).toEqual({ href });
    expect(await resolve("README.md", "text")).toMatchObject({ href: expect.any(String) });
    expect(await resolve("large/big.ts", "text")).toMatchObject({ href: expect.any(String) });
    for (const source of ["src/missing.ts", "large/none.ts", "github.com", "Node.js"])
      expect(await resolve(source, "text")).toBeNull();
    expect(await resolve("origin/main", "inline-code")).toBeNull();

    requests.length = 0;
    expect(await resolve("src/missing.ts", "markdown")).toMatchObject({ href: expect.any(String) });
    expect(requests).toEqual([]);

    const unsynced = createSessionLinkHandler({ workbench, projectId, origin: "http://local", onError: () => {} });
    expect(await unsynced.resolveResource!({ source: "README.md", origin: "text" })).toBeNull();
  } finally {
    getDashboardQueryClient().clear();
    server.stop(true);
    delete runtime.__PSTDIO_CONFIG__;
  }
});

test("chat paths use the session workspace while another workspace is selected", async () => {
  const workbench = projectWorkbench();
  workbench.pageLocations.navigate({
    kind: "page",
    page: workbenchPages.workspace,
    resource: { type: "workspace", id: "workspace-b" },
  });
  const errors: string[] = [];
  const handler = createSessionLinkHandler({
    workbench,
    projectId,
    workspace: workspace("workspace-a"),
    origin: "http://local",
    onError: (message) => errors.push(message),
  });
  const candidate = { source: "src/app.ts:12", origin: "markdown" as const };
  const href = handler.resolveHref(candidate)!;
  expect(parsePageUrl({ url: href, projectId, pages: workbench.pages.listPages() })?.resource).toMatchObject({
    id: "workspace-a",
    metadata: { workspaceFilePath: "src/app.ts" },
  });
  await handler.open(candidate);
  expect(workbench.pages.store.getState().location).toMatchObject({
    resource: { id: "workspace-a", metadata: { workspaceFilePath: "src/app.ts" } },
    position: { line: 12 },
  });
  const before = workbench.pages.store.getState().location;
  await handler.open({ source: "/repo/workspace-b/src/app.ts", origin: "tool" });
  expect(workbench.pages.store.getState().location).toBe(before);
  expect(errors).toHaveLength(1);
  await handler.open({ source: `http://local/projects/${projectId}/unknown`, origin: "markdown" });
  expect(workbench.pages.store.getState().location).toBe(before);
  expect(errors).toHaveLength(2);
  expect(
    handler.resolveHref({ source: "https://external.test/projects/other/workspace", origin: "markdown" }),
  ).toBeNull();
  selectDashboardProject(workbench, { id: "different-project", name: "Other" });
  await handler.open(candidate);
  expect(workbench.pages.store.getState().location).toBe(before);
});
