import { afterEach, describe, expect, test } from "bun:test";
import { createDashboardWorkspace } from "./workspace-actions";

const RUNTIME_CONFIG_KEY = "__PSTDIO_CONFIG__";

type RuntimeConfigWindow = {
  [RUNTIME_CONFIG_KEY]?: {
    apiBaseUrl?: string;
  };
};

const originalFetch = globalThis.fetch;

const toUrl = (input: URL | RequestInfo) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

describe("dashboard workspace actions", () => {
  afterEach(() => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
    globalThis.fetch = originalFetch;
  });

  test("passes the selected repository and base branch when creating a workspace", async () => {
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: "http://localhost:19840" };

    const calls: Array<{ method: string; url: string; body?: string }> = [];
    const fetchMock = Object.assign(
      async (input: URL | RequestInfo, init?: RequestInit | BunFetchRequestInit) => {
        const method = init?.method ?? "GET";
        const url = toUrl(input);
        const body = typeof init?.body === "string" ? init.body : undefined;
        calls.push({ method, url, body });

        if (method === "POST" && url.endsWith("/v1/workspaces")) {
          return new Response(
            JSON.stringify({
              id: "workspace-1",
              workspace_shorthand: "WS-1",
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          );
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      },
      { preconnect: originalFetch.preconnect?.bind(originalFetch) },
    ) as typeof fetch;
    globalThis.fetch = fetchMock;

    await createDashboardWorkspace({
      projectId: "project-1",
      repoId: "repo-1",
      base: "feature/custom-base",
    });

    expect(calls).toEqual([
      {
        method: "POST",
        url: "http://localhost:19840/v1/workspaces",
        body: JSON.stringify({
          project_id: "project-1",
          repo_id: "repo-1",
          base: "feature/custom-base",
        }),
      },
    ]);
  });
});
