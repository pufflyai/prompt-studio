import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Api, PocketCoderError } from "./connection";
import { cleanupRunEnvironment, type EnvironmentCleanupInput } from "./environment-cleanup";
import { activeRun } from "./environments";
import { localProcess } from "./process-fixture";
import { createRunStorage } from "./run-storage-fixture";
import { checkRun, listRuns, type RunDeps, startRun } from "./runs";

test("a definitive pre-admission template rejection preserves an explicitly kept workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "pr2409-rejected-"));
  try {
    await localProcess.runOrThrow({ command: ["git", "-C", root, "init", "-q"] });
    await Bun.write(join(root, "source.txt"), "source");
    const store = createRunStorage();
    const calls: string[] = [];
    const api: Api = async ({ method, path }) => {
      calls.push(`${method} ${path}`);
      if (method === "POST" && path.endsWith("/requests")) {
        throw new PocketCoderError(
          409,
          "Choose an agent template with the input-aware message operation.",
          "attachment.unsupported",
        );
      }
      if (method === "GET" && path.includes("/requests/")) throw new PocketCoderError(404, "Agent request not found.");
      return { id: "kept", state: "ready", metadata: { pstdio_project_id: "project" } } as never;
    };
    const intents: EnvironmentCleanupInput[] = [];
    const deps: RunDeps = {
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
      storage: { upload: async () => {}, signedUrl: async () => "http://localhost/source", download: async () => null },
      saveLog: async () => "run.log",
      cleanupEnvironment: async (input) => {
        intents.push(input);
        await cleanupRunEnvironment({ api, store }, input);
      },
    };
    await expect(startRun(deps, { root, environmentId: "kept", keepEnvironment: true })).rejects.toThrow("HTTP 409");
    const [record] = await listRuns(store);
    const afterLaunch = { summary: record.summary?.status, claim: await activeRun(store, "kept") };
    const clock = Date.now;
    Date.now = () => clock() + 3600_000;
    let outcome: Awaited<ReturnType<typeof checkRun>> | undefined;
    try {
      outcome = await checkRun(deps, record);
    } finally {
      Date.now = clock;
    }
    expect(afterLaunch).toEqual({ summary: "error", claim: null });
    expect(outcome).toMatchObject({ status: "error", error: expect.stringContaining("HTTP 409") });
    expect(calls).not.toContain("POST /v1/workspaces/kept/cancel");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.each([
  { status: 409, code: undefined },
  { status: 409, code: "request.in_progress" },
  { status: 503, code: "attachment.unsupported" },
])("ambiguous submission errors retain identity and workspace ownership (%j)", async ({ status, code }) => {
  const root = await mkdtemp(join(tmpdir(), "remote-uncertain-rejection-"));
  try {
    await localProcess.runOrThrow({ command: ["git", "-C", root, "init", "-q"] });
    await Bun.write(join(root, "source.txt"), "source");
    const store = createRunStorage();
    const cleanup: EnvironmentCleanupInput[] = [];
    const recovery: string[] = [];
    let submissions = 0;
    const api: Api = async ({ method, path }) => {
      if (method === "POST" && path.endsWith("/requests")) {
        submissions++;
        throw new PocketCoderError(status, "Submission response is uncertain", code);
      }
      return { id: "kept", state: "ready", metadata: { pstdio_project_id: "project" } } as never;
    };
    const deps: RunDeps = {
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
      storage: { upload: async () => {}, signedUrl: async () => "http://localhost/source", download: async () => null },
      saveLog: async () => "run.log",
      cleanupEnvironment: async (input) => {
        cleanup.push(input);
      },
      recoverRun: async (id) => {
        recovery.push(id);
      },
    };
    await expect(startRun(deps, { root, environmentId: "kept", keepEnvironment: true })).rejects.toThrow("uncertain");
    const [saved] = await listRuns(store);
    expect(saved.summary).toBeUndefined();
    expect(saved.requestId).toBeString();
    expect(saved.conversationId).toBeString();
    expect(await activeRun(store, "kept")).toBe(saved.runId);
    expect(recovery).toEqual([saved.runId]);
    expect(cleanup).toHaveLength(0);
    expect(submissions).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
