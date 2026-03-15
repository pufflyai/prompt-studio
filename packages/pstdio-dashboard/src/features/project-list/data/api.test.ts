import { afterEach, describe, expect, it } from "bun:test";
import { createProject } from "./api";

const RUNTIME_CONFIG_KEY = "__PSTDIO_CONFIG__";

type RuntimeConfigWindow = {
  [RUNTIME_CONFIG_KEY]?: {
    apiBaseUrl?: string;
    version?: string;
  };
};

const originalFetch = globalThis.fetch;

const toUrl = (input: URL | RequestInfo) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

describe("createProject", () => {
  afterEach(() => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
    globalThis.fetch = originalFetch;
  });

  it("removes the created project when repo registration fails", async () => {
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: "http://localhost:19840" };

    const calls: Array<{ method: string; url: string }> = [];
    const fetchMock = Object.assign(
      async (input: URL | RequestInfo, init?: RequestInit | BunFetchRequestInit) => {
        const method = init?.method ?? "GET";
        const url = toUrl(input);
        calls.push({ method, url });

        if (method === "POST" && url.endsWith("/v1/projects")) {
          return new Response(
            JSON.stringify({
              id: "project-1",
              name: "Prompt Studio",
              shorthand: "PS",
              created_at: "2026-03-15T10:00:00.000Z",
              updated_at: "2026-03-15T10:00:00.000Z",
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          );
        }

        if (method === "POST" && url.endsWith("/v1/projects/project-1/repos")) {
          return new Response(JSON.stringify({ error: "Repo is already linked to project project-x" }), {
            status: 409,
            headers: { "content-type": "application/json" },
          });
        }

        if (method === "DELETE" && url.endsWith("/v1/projects/project-1")) {
          return new Response(null, { status: 204 });
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      },
      { preconnect: originalFetch.preconnect?.bind(originalFetch) },
    ) as typeof fetch;
    globalThis.fetch = fetchMock;

    await expect(
      createProject({
        name: "Prompt Studio",
        repositories: [{ path: "/repos/prompt-studio", displayName: null }],
      }),
    ).rejects.toThrow("Repo is already linked to project project-x");

    expect(calls).toEqual([
      { method: "POST", url: "http://localhost:19840/v1/projects" },
      { method: "POST", url: "http://localhost:19840/v1/projects/project-1/repos" },
      { method: "DELETE", url: "http://localhost:19840/v1/projects/project-1" },
    ]);
  });
});
