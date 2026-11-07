import { expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { createWorkbench } from "@pstdio/workbench";
import { parsePageUrl } from "pstdio-api-contracts";
import { getDashboardQueryClient } from "@/lib/query-client";
import { createWorkspacesModule } from "@/modules/workspaces/module";
import { selectDashboardProject } from "@/shared/app/project-context";
import { openDashboardResource } from "@/shared/workbench/resource-openers";
import { buildDashboardWorkspaceOptionsFromRows } from "@/shared/workspaces/workspace-options";
import { registerWorkspaceProviderViews, workspacePages } from "@/workspaces-provider.test-support";
import { createSessionLinkHandler } from "./session-link-handler";

const openingResponse = async (request: Request) => {
  const { resources } = (await request.json()) as { resources: ResourceRef[] };
  return Response.json(
    resources.map((resource) => ({ resource, target: { kind: "page", page: workspacePages.files, resource } })),
  );
};

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
  registerWorkspaceProviderViews(workbench);
  workbench.registerModule(createWorkspacesModule());
  selectDashboardProject(workbench, { id: projectId, name: "Chat links" });
  workbench.pageLocations.setProject(projectId);
  return workbench;
};

test("a pending chat file opening yields to a newer resource opening", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
  const previous = runtime.__PSTDIO_CONFIG__;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const { resources } = (await request.json()) as { resources: ResourceRef[] };
      if (resources[0]?.id === "workspace-a") {
        entered.resolve();
        await release.promise;
      }
      return Response.json(
        resources.map((resource) => ({ resource, target: { kind: "page", page: workspacePages.files, resource } })),
      );
    },
  });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  const workbench = projectWorkbench();
  const errors: string[] = [];
  const handler = createSessionLinkHandler({
    workbench,
    projectId,
    workspace: workspace("workspace-a"),
    origin: "http://local",
    onError: (message) => errors.push(message),
  });
  const first = handler.open({ source: "src/app.ts:12", origin: "markdown" });
  try {
    await entered.promise;
    await openDashboardResource(workbench as WorkbenchModuleContext, {
      type: "workspace",
      extensionId: "pstdio",
      id: "workspace-b",
    });
    release.resolve();
    await first;
    expect(workbench.pages.store.getState().location?.resource?.id).toBe("workspace-b");
    expect(errors).toEqual([]);
  } finally {
    release.resolve();
    await first;
    workbench.dispose();
    runtime.__PSTDIO_CONFIG__ = previous;
    await server.stop(true);
  }
});

for (const kind of ["panel", "compound"] as const) {
  test(`session file links open a configured ${kind} destination`, async () => {
    const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
    const previous = runtime.__PSTDIO_CONFIG__;
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const { resources } = (await request.json()) as { resources: ResourceRef[] };
        return Response.json(
          resources.map((resource) => {
            const panel = {
              kind: "panel",
              panel: { kind: "page-slot", page: workspacePages.workspace, id: "files" },
            };
            return { resource, target: kind === "panel" ? panel : { kind: "compound", targets: [panel] } };
          }),
        );
      },
    });
    runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
    const workbench = projectWorkbench();
    workbench.pageLocations.navigate({
      kind: "page",
      page: workspacePages.workspace,
      resource: { type: "workspace", id: "workspace-a" },
    });
    const errors: string[] = [];
    const handler = createSessionLinkHandler({
      workbench,
      projectId,
      workspace: workspace("workspace-a"),
      origin: "http://local",
      onError: (message) => errors.push(message),
    });
    try {
      const candidate = { source: "src/app.ts:12", origin: "markdown" as const };
      expect(await handler.resolveResource!(candidate)).toEqual({ href: null });
      await handler.open(candidate);
      expect(errors).toEqual([]);
      expect(workbench.layout.getActivePanel("main")?.placementIdentity).toMatchObject({
        kind: "page",
        slotId: "files",
      });
    } finally {
      workbench.dispose();
      runtime.__PSTDIO_CONFIG__ = previous;
      await server.stop(true);
    }
  });
}

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
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/resource-openings")) return openingResponse(request);
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

    const href = (await resolve("src/app.ts:12", "inline-code"))?.href ?? null;
    expect(href).toContain("/extensions/pstdio.pstdio-workspaces/files");
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
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
  const server = Bun.serve({ port: 0, fetch: openingResponse });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  try {
    const workbench = projectWorkbench();
    workbench.pageLocations.navigate({
      kind: "page",
      page: workspacePages.workspace,
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
    const href = (await handler.resolveResource!(candidate))!.href!;
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
  } finally {
    await server.stop(true);
    delete runtime.__PSTDIO_CONFIG__;
  }
});

test("web link icons come from the runtime once per site", async () => {
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
  const requested: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const url = new URL(request.url);
      if (url.pathname !== "/v1/link-icons") return Response.json({ error: "Not found" }, { status: 404 });
      const target = url.searchParams.get("url")!;
      requested.push(target);
      return new URL(target).hostname === "github.com"
        ? Response.json({ data_url: "data:image/svg+xml;base64,PHN2Zy8+" })
        : Response.json({ error: "No icon found." }, { status: 404 });
    },
  });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.toString() };
  try {
    const handler = createSessionLinkHandler({
      workbench: projectWorkbench(),
      projectId,
      workspace: workspace("workspace-a"),
      origin: "http://local",
      onError: () => {},
    });

    expect(await handler.resolveIcon!("https://github.com/pufflyai/prompt-studio")).toBe(
      "data:image/svg+xml;base64,PHN2Zy8+",
    );
    expect(await handler.resolveIcon!("https://github.com/pufflyai")).toBe("data:image/svg+xml;base64,PHN2Zy8+");
    expect(await handler.resolveIcon!("https://no-icon.example.com/page")).toBeNull();
    expect(await handler.resolveIcon!("https://no-icon.example.com/other")).toBeNull();
    expect(requested).toEqual(["https://github.com/pufflyai/prompt-studio", "https://no-icon.example.com/page"]);
  } finally {
    getDashboardQueryClient().clear();
    server.stop(true);
    delete runtime.__PSTDIO_CONFIG__;
  }
});
