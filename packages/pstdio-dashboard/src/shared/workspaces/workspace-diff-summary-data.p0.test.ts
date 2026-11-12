import { afterEach, describe, expect, test } from "bun:test";
import { createRuntimeCollections, getWriter } from "@/lib/sync/collections";
import {
  getDashboardWorkspaceDiffSummary,
  requestDashboardWorkspaceDiffSummaries,
} from "./workspace-diff-summary-data";

const accountResponse = (request: Request) =>
  new URL(request.url).pathname.endsWith("/v1/account")
    ? Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true })
    : undefined;

const RUNTIME_CONFIG_KEY = "__PSTDIO_CONFIG__";

type RuntimeConfigWindow = {
  [RUNTIME_CONFIG_KEY]?: {
    apiBaseUrl?: string;
  };
};

const originalFetch = globalThis.fetch;

test("derived diff data and late responses stay in their originating runtime", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: (request) =>
      accountResponse(request) ??
      Response.json({
        workspace_id: "same",
        additions: new URL(request.url).pathname.startsWith("/first/") ? 1 : 2,
        deletions: 0,
        file_count: 1,
      }),
  });
  const first = createRuntimeCollections({ baseUrl: `${server.url.origin}/first`, token: "" });
  const second = createRuntimeCollections({ baseUrl: `${server.url.origin}/second`, token: "" });
  try {
    for (const owner of [first, second])
      owner.getWriter("workspaces")!.upsert({
        id: "same",
        provider_state: "ready",
        root_path: "/same",
        provider_capabilities_json: { diff: true },
      });
    const [a, b] = await Promise.all([
      requestDashboardWorkspaceDiffSummaries(["same"], undefined, first),
      requestDashboardWorkspaceDiffSummaries(["same"], undefined, second),
    ]);
    expect(a.get("same")?.additions).toBe(1);
    expect(b.get("same")?.additions).toBe(2);
    expect(getDashboardWorkspaceDiffSummary("same", first)?.additions).toBe(1);
    expect(getDashboardWorkspaceDiffSummary("same", second)?.additions).toBe(2);
  } finally {
    await first.dispose();
    await second.dispose();
    server.stop(true);
  }
});

test("remote summary reads do not open a permanently unsupported local file watch", async () => {
  let watches = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const account = accountResponse(request);
      if (account) return account;
      if (new URL(request.url).pathname === "/v1/session-stream") watches++;
      return Response.json({ workspace_id: "remote", additions: 3, deletions: 1, file_count: 1 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  owner.getWriter("workspaces")!.upsert({
    id: "remote",
    project_id: "project",
    execution_kind: "remote",
    provider_state: "ready",
    provider_capabilities_json: { diff: true },
  });
  try {
    expect((await requestDashboardWorkspaceDiffSummaries(["remote"], undefined, owner)).get("remote")?.additions).toBe(
      3,
    );
    expect(watches).toBe(0);
  } finally {
    await owner.dispose();
    await server.stop(true);
  }
});

test("overlapping summary batches share one four-read runtime admission limit", async () => {
  const release = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  let active = 0;
  let maximum = 0;
  const before = globalThis.fetch;
  globalThis.fetch = Object.assign(
    async (request: URL | RequestInfo) => {
      const url = new URL(toUrl(request));
      if (url.origin !== "http://diff-admission.test") return before(request);
      if (url.pathname === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      maximum = Math.max(maximum, ++active);
      if (active >= 4) started.resolve();
      await release.promise;
      active--;
      return Response.json({ workspace_id: url.pathname.split("/")[3], additions: 1, deletions: 0, file_count: 1 });
    },
    { preconnect: before.preconnect },
  ) as typeof fetch;
  const owner = createRuntimeCollections({ baseUrl: "http://diff-admission.test", token: "" });
  const ids = Array.from({ length: 12 }, (_, index) => `bounded-${index}`);
  for (const id of ids)
    owner
      .getWriter("workspaces")!
      .upsert({ id, provider_state: "ready", root_path: "/project", provider_capabilities_json: { diff: true } });
  const reads = Promise.all([
    requestDashboardWorkspaceDiffSummaries(ids.slice(0, 6), undefined, owner),
    requestDashboardWorkspaceDiffSummaries(ids.slice(6), undefined, owner),
  ]);
  try {
    await started.promise;
    await Promise.resolve();
    release.resolve();
    await reads;
    expect(maximum).toBe(4);
  } finally {
    release.resolve();
    await reads;
    await owner.dispose();
    globalThis.fetch = before;
  }
});

const toUrl = (input: URL | RequestInfo) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

describe("workspace diff summary data", () => {
  afterEach(() => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
    globalThis.fetch = originalFetch;
    getWriter("workspaces")!.remove("workspace-first-load");
  });

  test("resolves requested summaries for initial render updates", async () => {
    const calls: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const account = accountResponse(request);
        if (account) return account;
        calls.push(request.url);
        return Response.json({ workspace_id: "workspace-first-load", additions: 12, deletions: 3, file_count: 2 });
      },
    });
    const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
    owner.getWriter("workspaces")!.upsert({
      id: "workspace-first-load",
      provider_state: "ready",
      root_path: "/project",
      provider_capabilities_json: { diff: true },
    });
    try {
      const summaries = await requestDashboardWorkspaceDiffSummaries(["workspace-first-load"], undefined, owner);
      expect(calls).toEqual([`${server.url.origin}/v1/workspaces/workspace-first-load/diff-summary?mode=fork_point`]);
      expect(summaries.get("workspace-first-load")).toMatchObject({ additions: 12, deletions: 3, fileCount: 2 });
      expect(getDashboardWorkspaceDiffSummary("workspace-first-load", owner)).toMatchObject({
        additions: 12,
        deletions: 3,
        fileCount: 2,
      });
    } finally {
      await owner.dispose();
      server.stop(true);
    }
  });

  test("requests summaries only while a workspace declares diff support", async () => {
    const workspaceId = "workspace-diff-capability";
    const requests: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch: (request) => {
        const account = accountResponse(request);
        if (account) return account;
        requests.push(new URL(request.url).pathname);
        return Response.json({ workspace_id: workspaceId, additions: 1, deletions: 0, file_count: 1 });
      },
    });
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: server.url.toString() };
    const writer = getWriter("workspaces")!;

    try {
      for (const diff of [false, undefined]) {
        writer.upsert({
          id: workspaceId,
          provider_state: "ready",
          root_path: "/project",
          provider_capabilities_json: { files: "write", diff },
        });
        expect(await requestDashboardWorkspaceDiffSummaries([workspaceId])).toEqual(new Map());
        expect(requests).toEqual([]);
      }
      writer.upsert({
        id: workspaceId,
        provider_state: "ready",
        root_path: "/project",
        provider_capabilities_json: { files: "write", diff: true },
      });
      expect((await requestDashboardWorkspaceDiffSummaries([workspaceId])).get(workspaceId)).toMatchObject({
        additions: 1,
        deletions: 0,
        fileCount: 1,
      });
      expect(requests).toEqual([`/v1/workspaces/${workspaceId}/diff-summary`]);

      writer.upsert({
        id: workspaceId,
        provider_state: "ready",
        root_path: "/project",
        provider_capabilities_json: { files: "write", diff: false },
      });
      expect(await requestDashboardWorkspaceDiffSummaries([workspaceId])).toEqual(new Map());
      expect(requests).toHaveLength(1);
    } finally {
      writer.remove(workspaceId);
      server.stop(true);
    }
  });
});

test("defers background diff requests until the synced workspace is ready", async () => {
  const workspaceId = "workspace-diff-readiness";
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const account = accountResponse(request);
      if (account) return account;
      requests.push(new URL(request.url).pathname);
      return Response.json({ workspace_id: workspaceId, additions: 1, deletions: 0, file_count: 1 });
    },
  });
  (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: server.url.toString() };
  const writer = getWriter("workspaces")!;
  const row = {
    id: workspaceId,
    initializing: false,
    setup_error: null,
    provider_error_json: null,
    provider_state: "ready",
    execution_kind: "local",
    root_path: "/project",
    provider_capabilities_json: { diff: true },
  };
  try {
    expect(await requestDashboardWorkspaceDiffSummaries([workspaceId])).toEqual(new Map());
    expect(requests).toEqual([]);
    for (const state of [
      { initializing: true },
      { setup_error: "Setup failed" },
      { provider_error_json: { message: "Provider failed" } },
      { provider_state: "provisioning" },
    ]) {
      writer.upsert({ ...row, ...state });
      expect(await requestDashboardWorkspaceDiffSummaries([workspaceId])).toEqual(new Map());
      expect(requests).toEqual([]);
    }
    writer.upsert(row);
    expect((await requestDashboardWorkspaceDiffSummaries([workspaceId])).get(workspaceId)).toMatchObject({
      additions: 1,
      fileCount: 1,
    });
    expect(requests).toEqual([`/v1/workspaces/${workspaceId}/diff-summary`]);
    writer.upsert({ ...row, initializing: true });
    expect(await requestDashboardWorkspaceDiffSummaries([workspaceId])).toEqual(new Map());
    expect(requests).toHaveLength(1);
  } finally {
    writer.remove(workspaceId);
    server.stop(true);
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
  }
});

test("does not request a summary when workspace diff support is explicitly disabled", async () => {
  const workspaceId = "disabled-diff-workspace";
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const account = accountResponse(request);
      if (account) return account;
      requests.push(new URL(request.url).pathname);
      return Response.json({ workspace_id: workspaceId, additions: 1, deletions: 0, file_count: 1 });
    },
  });
  (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: server.url.toString() };
  const writer = getWriter("workspaces")!;
  try {
    writer.upsert({ id: workspaceId, provider_state: "ready", provider_capabilities_json: { diff: false } });
    expect(await requestDashboardWorkspaceDiffSummaries([workspaceId])).toEqual(new Map());
    expect(requests).toEqual([]);
  } finally {
    writer.remove(workspaceId);
    server.stop(true);
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
  }
});

test("one unavailable diff summary does not hide other workspaces", async () => {
  const ids = ["diff-unavailable", "diff-available"];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const account = accountResponse(request);
      if (account) return account;
      if (new URL(request.url).pathname.includes(ids[0])) return new Response("Diff unavailable", { status: 500 });
      return Response.json({ workspace_id: ids[1], additions: 2, deletions: 1, file_count: 1 });
    },
  });
  (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: server.url.toString() };
  const writer = getWriter("workspaces")!;
  try {
    for (const id of ids)
      writer.upsert({ id, provider_state: "ready", root_path: "/project", provider_capabilities_json: { diff: true } });
    const summaries = await requestDashboardWorkspaceDiffSummaries(ids);
    expect(summaries.has(ids[0])).toBe(false);
    expect(summaries.get(ids[1])).toMatchObject({ additions: 2, deletions: 1, fileCount: 1 });
    const abort = new AbortController();
    abort.abort();
    await expect(requestDashboardWorkspaceDiffSummaries(ids, abort.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  } finally {
    for (const id of ids) writer.remove(id);
    server.stop(true);
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
  }
});
