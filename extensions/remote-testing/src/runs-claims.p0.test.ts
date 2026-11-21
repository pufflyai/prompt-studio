import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { Api } from "./connection";
import { activeRun, claimEnvironment } from "./environments";
import { localProcess } from "./process-fixture";
import { checkRun, type RunDeps, startRun } from "./runs";

let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "remote-testing-claims-"));
  await writeFile(join(root, "source.txt"), "source");
  for (const args of [
    ["init", "-q"],
    ["add", "."],
    ["-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-qm", "source"],
  ])
    await localProcess.runOrThrow({ command: ["git", "-C", root, ...args] });
});
afterAll(() => rm(root, { recursive: true, force: true }));

function runDeps(api: Api, store: ReturnType<typeof createMemoryStorage>) {
  return {
    projectId: "project",
    api,
    store,
    process: localProcess,
    settings: {
      templateName: "tests",
      templateVersion: "1",
      testCommand: "bun test",
      timeoutMinutes: 1,
      storageBucket: "fixture",
      signerAccount: "fixture",
    },
    publishTemplate: async () => ({ name: "branch", version: "1" }),
    storage: {
      upload: async () => {},
      signedUrl: async () => "http://localhost/source",
      download: async () => new Uint8Array(),
    },
    saveLog: async () => "run.log",
  } satisfies RunDeps;
}

test.each([
  { ref: "HEAD" },
  { branchTemplate: true },
  { kind: "preview" as const },
])("a branch run owns its environment through provisioning and collection (%j)", async (input) => {
  const store = createMemoryStorage();
  const provisioning = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<void>();
  const requests: string[] = [];
  const environment = {
    id: "branch-env",
    state: "provisioning",
    change_cursor: 0,
    metadata: { pstdio_project_id: "project" },
  };
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      requests.push(`${request.method} ${path}`);
      if (path.endsWith("/changes")) {
        provisioning.resolve();
        await ready.promise;
        return Response.json({ workspace: { ...environment, state: "ready" } });
      }
      if (path.includes("/requests/"))
        return Response.json({
          finalizedAt: new Date().toISOString(),
          acceptance: { execution: {} },
          outcome: { finalResponse: 'REMOTE_TEST_RESULT {"exitCode":0,"durationMs":1,"timedOut":false}' },
        });
      return Response.json(environment);
    },
  });
  const api: Api = async ({ path, method, body }) => {
    const response = await fetch(new URL(path, server.url), {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return response.json() as never;
  };
  const deps = runDeps(api, store);
  const running = startRun(deps, { root, ...input });
  try {
    await provisioning.promise;
    const claim = await activeRun(store, environment.id);
    expect(claim).toBeString();
    await expect(startRun(deps, { root, environmentId: environment.id })).rejects.toThrow("another test run");
    ready.resolve();
    const { record } = await running;
    expect(claim).toBe(record.runId);
    expect((await checkRun(deps, record))?.status).toBe("passed");
    expect(await activeRun(store, environment.id)).toBeNull();
    expect(requests.filter((request) => request === "POST /v1/workspaces/branch-env/requests")).toHaveLength(1);
    expect(requests).toContain("POST /v1/workspaces/branch-env/cancel");
  } finally {
    ready.resolve();
    await running.catch(() => {});
    server.stop(true);
  }
});

test.each([
  false,
  true,
])("failed branch setup only stops an environment it owns (other owner: %s)", async (otherOwner) => {
  const store = createMemoryStorage();
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      requests.push(path);
      if (path === "/v1/workspaces" && otherOwner) await claimEnvironment(store, "branch-env", "other-running-run", 60);
      if (path.endsWith("/requests")) return new Response("Submission failed", { status: 503 });
      return Response.json({ id: "branch-env", state: "ready", metadata: { pstdio_project_id: "project" } });
    },
  });
  const api: Api = async ({ path, method, body }) => {
    const response = await fetch(new URL(path, server.url), {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as never;
  };
  try {
    await expect(startRun(runDeps(api, store), { root, branchTemplate: true })).rejects.toThrow(
      otherOwner ? "another test run" : "Submission failed",
    );
    expect(requests.includes("/v1/workspaces/branch-env/cancel")).toBe(!otherOwner);
    expect(await activeRun(store, "branch-env")).toBe(otherOwner ? "other-running-run" : null);
  } finally {
    server.stop(true);
  }
});
