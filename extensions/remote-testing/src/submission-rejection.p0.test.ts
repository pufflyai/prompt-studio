import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Api, PocketCoderError } from "./connection";
import { cleanupRunEnvironment, type EnvironmentCleanupInput } from "./environment-cleanup";
import { activeRun } from "./environments";
import { localProcess } from "./process-fixture";
import { createRunStorage } from "./run-storage-fixture";
import { checkRun, listRuns, type RunDeps, type RunSummary, startRun } from "./runs";

test.each([
  "none",
  "transient",
  "aborted",
] as const)("a definitive pre-admission rejection preserves a kept workspace (save fault: %s)", async (saveFault) => {
  const root = await mkdtemp(join(tmpdir(), "pr2409-rejected-"));
  try {
    await localProcess.runOrThrow({ command: ["git", "-C", root, "init", "-q"] });
    await Bun.write(join(root, "source.txt"), "source");
    const store = createRunStorage();
    const calls: string[] = [];
    let failures = 0;
    let attemptedSummary: RunSummary | undefined;
    const controller = new AbortController();
    const commit = store.records.commitIfCurrent;
    store.records.commitIfCurrent = async (group) => {
      if (saveFault !== "none" && !failures && group.edits.some((edit) => edit.set?.["/summary"])) {
        failures++;
        attemptedSummary = group.edits.find((edit) => edit.set?.["/summary"])?.set?.[
          "/summary"
        ] as unknown as RunSummary;
        if (saveFault === "aborted") controller.abort(new Error("Stopped local rejection preparation"));
        expect(await activeRun(store, "kept")).toBeString();
        expect(intents).toHaveLength(0);
        throw new Error("One transient summary write failure");
      }
      return commit(group);
    };
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
        const saved = await store.get<{ summary?: { status: string; error?: string } }>(`run:${input.runId}`);
        expect(saved?.summary).toMatchObject({ status: "error", error: expect.stringContaining("HTTP 409") });
        expect(await activeRun(store, "kept")).toBe(input.runId);
        intents.push(input);
        await cleanupRunEnvironment({ api, store }, input);
      },
    };
    await expect(
      startRun(deps, { root, environmentId: "kept", keepEnvironment: true }, controller.signal),
    ).rejects.toThrow(saveFault === "aborted" ? "Stopped local rejection preparation" : "HTTP 409");
    const [record] = await listRuns(store);
    if (saveFault === "aborted") {
      expect(record.summary).toBeUndefined();
      expect(await activeRun(store, "kept")).toBe(record.runId);
      expect(intents).toEqual([]);
      expect(calls.filter((call) => call.endsWith("/requests"))).toHaveLength(1);
      return;
    }
    if (attemptedSummary) expect(record.summary).toEqual(attemptedSummary);
    const afterLaunch = { summary: record.summary?.status, claim: await activeRun(store, "kept") };
    const clock = Date.now;
    Date.now = () => clock() + 3600_000;
    let outcome: Awaited<ReturnType<typeof checkRun>> | undefined;
    try {
      outcome = await checkRun(deps, record);
    } finally {
      Date.now = clock;
    }
    expect(failures).toBe(Number(saveFault === "transient"));
    expect(intents).toEqual([]);
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
