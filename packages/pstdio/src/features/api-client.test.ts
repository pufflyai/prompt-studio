import { afterEach, expect, it } from "bun:test";
import { apiClient, resetApiClient } from "./api-client";
import { resolveApiUrl } from "./api-url";

const originalApiUrl = process.env.PSTDIO_API_URL;
const originalApiToken = process.env.PSTDIO_API_TOKEN;

afterEach(() => {
  resetApiClient();
  if (originalApiUrl === undefined) delete process.env.PSTDIO_API_URL;
  else process.env.PSTDIO_API_URL = originalApiUrl;
  if (originalApiToken === undefined) delete process.env.PSTDIO_API_TOKEN;
  else process.env.PSTDIO_API_TOKEN = originalApiToken;
});

it("keeps each runtime client bound to its own URL and credential", async () => {
  const calls: { url: string; token: string | null }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      calls.push({ url: request.url, token: request.headers.get("authorization") });
      return Response.json([]);
    },
  });
  const other = Bun.serve({
    port: 0,
    fetch: (request) => {
      calls.push({ url: request.url, token: request.headers.get("authorization") });
      return Response.json([]);
    },
  });
  try {
    process.env.PSTDIO_API_URL = server.url.origin;
    process.env.PSTDIO_API_TOKEN = "first";
    const first = apiClient();
    process.env.PSTDIO_API_URL = other.url.origin;
    process.env.PSTDIO_API_TOKEN = "second";
    const second = apiClient();
    await first.projects.list();
    await second.projects.list();
    expect(calls).toEqual([
      { url: `${server.url.origin}/v1/projects`, token: "Bearer first" },
      { url: `${other.url.origin}/v1/projects`, token: "Bearer second" },
    ]);
  } finally {
    server.stop(true);
    other.stop(true);
  }
});

it("uses the same default API URL as the rest of the CLI", async () => {
  resetApiClient();
  delete process.env.PSTDIO_API_URL;
  const requested: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requested.push(String(input instanceof Request ? input.url : input));
    return Response.json({ projects: [] });
  }) as typeof fetch;

  try {
    await apiClient().projects.list();
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requested[0]?.startsWith(resolveApiUrl())).toBe(true);
});
