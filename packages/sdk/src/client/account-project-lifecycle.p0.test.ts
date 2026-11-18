import { expect, test } from "bun:test";
import type { CloudProjectDeletion, LocalRemovalPreflight } from "pstdio-api-contracts";
import { createClient, LocalRemovalConflictError, PstdioApiError } from "./index";

const projectId = "notes/2026";
const preflight: LocalRemovalPreflight = {
  projectId,
  name: "Shared notes",
  uploadState: "unknown",
  requiresDiscard: true,
  removesManagedFolder: true,
  providerWorkspaceCount: 2,
};
const deletion: CloudProjectDeletion = {
  projectId,
  operationId: "deletion-operation",
  state: "deleting",
  startedAt: "2026-11-18T10:00:00Z",
  completedAt: null,
};

const createFixture = (...responses: Response[]) => {
  const requests: Request[] = [];
  const { account } = createClient({
    baseUrl: "http://test",
    token: "host-token",
    fetch: (async (url: string, init: RequestInit) => {
      const request = new Request(url, init);
      expect(request.headers.get("authorization")).toBe("Bearer host-token");
      requests.push(request);
      return responses.shift()!;
    }) as typeof fetch,
  });
  return { requests, account };
};

test("reads the catalog and preflight and requests a download through public account routes", async () => {
  const catalog = { projects: [], deletions: [{ ...deletion, name: preflight.name }] };
  const download = { projectId, presence: "downloading" as const };
  const { requests, account } = createFixture(
    Response.json(catalog),
    Response.json(preflight),
    Response.json(download, { status: 202 }),
  );
  expect(await account.projectsCatalog()).toEqual(catalog);
  expect(await account.projectLocalRemoval(projectId)).toEqual(preflight);
  expect(await account.downloadCloudProject(projectId)).toEqual(download);
  expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
    ["GET", "/v1/account/projects"],
    ["GET", "/v1/account/projects/notes%2F2026/local-removal"],
    ["POST", "/v1/account/projects/notes%2F2026/download"],
  ]);
});

test("keeps the safe default and reports fresh preflight with a typed conflict", async () => {
  const conflict = { code: "project_local_removal_discard_required", error: "Acknowledge discard", details: preflight };
  const removed = { projectId, presence: "cloud-only" as const };
  const { requests, account } = createFixture(Response.json(conflict, { status: 409 }), Response.json(removed));
  const error = await account.removeLocalProject(projectId).catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(LocalRemovalConflictError);
  expect(error).toMatchObject({ status: 409, code: conflict.code, preflight });
  expect(await account.removeLocalProject(projectId, { discardUnsynced: true })).toEqual(removed);
  expect(requests[0]?.url).toEndWith("/notes%2F2026/remove-local");
  expect(await requests[0]?.json()).toEqual({});
  expect(await requests[1]?.json()).toEqual({ discardUnsynced: true });
});

test("preserves errors and distinguishes authoritative acceptance from completed cleanup", async () => {
  const completed: CloudProjectDeletion = { ...deletion, state: "completed", completedAt: "2026-11-18T10:01:00Z" };
  const { requests, account } = createFixture(
    Response.json({ error: "No operation" }, { status: 404 }),
    Response.json(deletion, { status: 202 }),
    Response.json(completed),
    Response.json(completed),
  );
  await expect(account.projectDeletionStatus(projectId)).rejects.toBeInstanceOf(PstdioApiError);
  expect(await account.deleteCloudProject(projectId, { confirm: true })).toEqual(deletion);
  expect(await account.projectDeletionStatus(projectId)).toEqual(completed);
  expect(await account.deleteCloudProject(projectId, { confirm: true })).toEqual(completed);
  expect(await requests[1]!.json()).toEqual({ confirm: true });
  expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
    ["GET", "/v1/account/projects/notes%2F2026/deletion"],
    ["POST", "/v1/account/projects/notes%2F2026/delete-cloud"],
    ["GET", "/v1/account/projects/notes%2F2026/deletion"],
    ["POST", "/v1/account/projects/notes%2F2026/delete-cloud"],
  ]);
});
