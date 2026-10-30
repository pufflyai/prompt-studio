import { createClient } from "@pstdio/sdk/client";

export const previewFetch: typeof fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== "https://canvas.invalid") throw new Error(`Missing local preview fixture: ${url.pathname}`);
  const summary = url.pathname.match(/^\/v1\/workspaces\/([^/]+)\/diff-summary$/);
  if (request.method === "GET" && summary) {
    return Response.json({ workspace_id: summary[1], additions: 128, deletions: 14, file_count: 6 });
  }
  return Response.json({ message: `No local fixture for ${request.method} ${url.pathname}` }, { status: 501 });
}, fetch);
export const apiClientOptions = () => ({ baseUrl: "https://canvas.invalid", token: "", fetch: previewFetch });
const client = createClient(apiClientOptions());
export const getApiClient = () => client;
export const buildApiUrl = (path: string) => new URL(path, "https://canvas.invalid").href;
export const buildAbsoluteApiUrl = (path: string) => buildApiUrl(path);
export const readRuntimeConfig = () => ({ apiBaseUrl: "https://canvas.invalid" });
