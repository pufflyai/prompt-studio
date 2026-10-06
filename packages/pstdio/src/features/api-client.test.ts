import { afterEach, expect, it } from "bun:test";
import { apiClient, resetApiClient } from "./api-client";
import { resolveApiUrl } from "./api-url";

const originalApiUrl = process.env.PSTDIO_API_URL;

afterEach(() => {
  resetApiClient();
  if (originalApiUrl === undefined) delete process.env.PSTDIO_API_URL;
  else process.env.PSTDIO_API_URL = originalApiUrl;
});

it("uses the same default API URL as the rest of the CLI", async () => {
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
