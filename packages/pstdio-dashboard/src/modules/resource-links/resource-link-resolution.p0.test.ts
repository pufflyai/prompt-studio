import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { resolveLinkedResources } from "./resource-link-resolution";

test("bare links resolve once and preview in Side without leaving their source page", async () => {
  const calls: unknown[] = [];
  const refs = ["one", "two"].map((id) => ({ type: "workspace", id, extensionId: "pstdio", projectId: "project" }));
  const target = {
    kind: "page" as const,
    page: { kind: "page" as const, extensionId: "example.viewer", id: "inspect" },
    resource: refs[0],
  };
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
  const previous = runtime.__PSTDIO_CONFIG__;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (request.method === "GET") return Response.json({ login: null, cloudProjects: [] });
      calls.push({ path: new URL(request.url).pathname, body: await request.json() });
      return Response.json([{ resource: refs[1] }, { resource: refs[0], target }]);
    },
  });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  const ctx = createWorkbench();
  try {
    ctx.modes.registerMode({ id: "project", activate() {} });
    ctx.views.registerView({ id: "reader", title: "Reader", body: { kind: "react", render: () => null } });
    ctx.pages.registerPage({
      id: "collection",
      ref: { kind: "page", extensionId: "example.viewer", id: "collection" },
      path: "collection",
      modeId: "project",
      main: { kind: "panels" },
      slots: [],
    });
    ctx.pages.registerPage({
      id: "inspect",
      ref: target.page,
      path: "inspect",
      modeId: "project",
      parentId: "collection",
      resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
      main: { kind: "view", view: { kind: "view", id: "reader" }, cardinality: "one" },
      slots: [],
    });
    ctx.pageLocations.setProject("project");
    selectDashboardProject(ctx, { id: "project", name: "Project" });
    ctx.pageLocations.navigate({ kind: "page", page: ctx.pages.getPage("collection")!.ref });
    const result = await resolveLinkedResources(ctx as WorkbenchModuleContext, "project", [
      refs[0]!,
      refs[1]!,
      refs[0]!,
    ]);
    expect(calls).toEqual([{ path: "/v1/projects/project/resource-openings", body: { resources: refs } }]);
    expect(result).toMatchObject([
      { resource: refs[0], target },
      { resource: refs[1], target: undefined, open: undefined },
    ]);
    const source = ctx.pages.store.getState().location;
    await result[0]!.open!();
    expect(ctx.pages.store.getState().location).toEqual(source);
    expect(ctx.layout.getActivePanel("side")).toMatchObject({ resource: refs[0], tabRetention: "preview" });
    selectDashboardProject(ctx, { id: "another", name: "Another project" });
    const before = ctx.pages.store.getState().location;
    await result[0]!.open!();
    expect(ctx.pages.store.getState().location).toEqual(before);
  } finally {
    ctx.dispose();
    runtime.__PSTDIO_CONFIG__ = previous;
    await server.stop(true);
  }
});
