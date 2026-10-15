import { expect, test } from "bun:test";
import { createClient } from "./client";

test("attaches an initial workspace and retries setup through the public project client", async () => {
  const requests: Request[] = [];
  const workspace = { id: "home", project_id: "project", is_default: true, root_path: "/documents" };
  const client = createClient({
    baseUrl: "http://test",
    fetch: (async (url: string, init: RequestInit) => {
      requests.push(new Request(url, init));
      return Response.json(workspace);
    }) as typeof fetch,
  });
  const initial = { provider_id: "pstdio.root", params: { path: "/documents" } };
  expect(await client.projects.attachInitialWorkspace("project", initial)).toMatchObject(workspace);
  expect(requests[0]!.url).toBe("http://test/v1/projects/project/initial-workspace");
  expect(await requests[0]!.json()).toEqual(initial);
  expect(await client.projects.retrySetup("project")).toMatchObject(workspace);
  expect(requests[1]!.url).toBe("http://test/v1/projects/project/retry-setup");
  expect(requests.map((request) => request.method)).toEqual(["POST", "POST"]);
});

test("binds and resolves an explicit environment through the public client", async () => {
  const target = { environmentId: "local", workbenchId: "shared", workspaceId: "home" };
  const workspace = { id: "home", project_id: "shared", root_path: "/local/folder" };
  const binding = { environmentId: "local", workbenchId: "shared", workspace };
  const input = {
    environmentId: "local",
    name: "Shared",
    initial_workspace: { provider_id: "pstdio.root", params: { path: workspace.root_path } },
  };
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      expect(request.headers.get("authorization")).toBe("Bearer owner");
      const path = new URL(request.url).pathname;
      if (path === "/v1/environment") return Response.json({ environmentId: "local" });
      if (path === "/v1/environment/resolve-target") {
        expect(request.method).toBe("POST");
        expect(await request.json()).toEqual(target);
        return Response.json(workspace);
      }
      expect(path).toBe("/v1/projects/shared/environment-binding");
      expect(request.method).toBe("PUT");
      expect(await request.json()).toEqual(input);
      return Response.json(binding);
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin, token: "owner" });
    expect(await client.runtime.environment()).toEqual({ environmentId: "local" });
    expect(await client.projects.bindEnvironment("shared", input)).toMatchObject(binding);
    expect(await client.runtime.resolveTarget(target)).toMatchObject(workspace);
  } finally {
    server.stop(true);
  }
});
