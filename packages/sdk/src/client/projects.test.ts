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
