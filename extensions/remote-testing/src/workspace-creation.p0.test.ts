import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeCommandContext } from "@pstdio/sdk/testing";
import type { Api } from "./connection";
import { recoverEnvironmentCleanup, resumeEnvironmentCleanups } from "./environment-cleanup";
import { activeRun } from "./environments";
import { localProcess } from "./process-fixture";
import { createRunStorage } from "./run-storage-fixture";
import { type RunDeps, startRun } from "./runs";

let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "remote-workspace-creation-"));
  await localProcess.runOrThrow({ command: ["git", "-C", root, "init", "-q"] });
  await Bun.write(join(root, "source.txt"), "source");
});
afterAll(() => rm(root, { recursive: true, force: true }));

function fixture(options: { reply?: Promise<void>; stopFailures?: boolean } = {}) {
  const store = createRunStorage();
  const workspace = { id: "created", external_id: "", state: "ready", metadata: {} };
  const calls: string[] = [];
  let visible = false;
  let stopAttempts = 0;
  const posted = Promise.withResolvers<void>();
  const replyToCreate = async () => {
    if (!options.reply) throw new TypeError("Accepted workspace reply was lost");
    await options.reply;
    return workspace;
  };
  const replyToStop = () => {
    stopAttempts++;
    if (options.stopFailures && stopAttempts === 1) throw new TypeError("Temporary cancel failure");
    if (options.stopFailures && stopAttempts === 2) return { ...workspace, state: "queued" };
    workspace.state = "canceled";
    return workspace;
  };
  const api: Api = async ({ method, path, headers, body }) => {
    calls.push(`${method} ${path}`);
    if (method === "POST" && path === "/v1/workspaces") {
      const input = body as { external_id: string; metadata: Record<string, string> };
      expect(headers?.["Idempotency-Key"]).toBe(input.external_id);
      workspace.external_id = input.external_id;
      workspace.metadata = input.metadata;
      posted.resolve();
      return replyToCreate() as never;
    }
    if (method === "GET" && path.startsWith("/v1/workspaces?")) {
      const query = new URL(path, "https://controller.invalid").searchParams;
      if (!query.has("external_id")) return { items: [], next_cursor: null } as never;
      expect(query.get("external_id")).toBe(workspace.external_id);
      return {
        items: [
          { ...workspace, id: "other-project", metadata: { purpose: "remote-testing", pstdio_project_id: "other" } },
          ...(visible ? [workspace] : []),
        ],
        next_cursor: null,
      } as never;
    }
    if (method === "POST" && path === "/v1/workspaces/created/cancel") return replyToStop() as never;
    throw new Error(`Unexpected controller request ${method} ${path}`);
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
    saveLog: async () => "unused",
    cleanupEnvironment: async () => {},
  };
  const context = () =>
    makeCommandContext({
      storage: store,
      params: {},
      overrides: {
        projectId: "project",
        connections: {
          request: async <T>(_id: string, input: Parameters<Api>[0]) => ({
            status: 200,
            headers: {},
            body: await api<T>(input),
          }),
        },
      },
    });
  const recover = () => recoverEnvironmentCleanup.run(context(), {});
  return {
    deps,
    workspace,
    calls,
    context,
    recover,
    posted: posted.promise,
    reveal: () => {
      visible = true;
    },
  };
}

test("recovery cancels an accepted workspace whose create reply was lost", async () => {
  const f = fixture({ stopFailures: true });
  await expect(startRun(f.deps, { root })).rejects.toThrow("Accepted workspace reply was lost");
  await f.recover();
  expect(f.workspace.state).toBe("ready");
  f.reveal();
  await f.recover();
  expect(f.workspace.state).toBe("ready");
  await f.recover();
  expect(f.workspace.state).toBe("ready");
  await f.recover();
  expect(f.workspace.state).toBe("canceled");
  const prior = f.calls.slice();
  await f.recover();
  expect(f.calls).toEqual(prior);
  expect(f.calls.filter((call) => call.startsWith("POST"))).toEqual([
    "POST /v1/workspaces",
    "POST /v1/workspaces/created/cancel",
    "POST /v1/workspaces/created/cancel",
    "POST /v1/workspaces/created/cancel",
  ]);
});

test("an expired launcher cannot submit a run after recovery takes over", async () => {
  const reply = Promise.withResolvers<void>();
  const f = fixture({ reply: reply.promise });
  const outcome = startRun(f.deps, { root }).catch((error: unknown) => error);
  try {
    await f.posted;
    f.reveal();
    const before = f.calls.slice();
    await f.recover();
    expect(f.calls).toEqual(before);
    const records = f.deps.store.collection<{ leaseUntil: number }>("workspace-creations");
    const pending = await records.get(f.workspace.external_id);
    await records.put(f.workspace.external_id, { ...pending!, leaseUntil: 0 });
    await f.recover();
    expect(f.workspace.state).toBe("canceled");
    reply.resolve();
    expect(await outcome).toEqual(new Error("Workspace creation was already recovered."));
    expect(await activeRun(f.deps.store, f.workspace.id)).toBeNull();
    expect(f.calls.some((call) => call.endsWith("/requests"))).toBe(false);
  } finally {
    reply.resolve();
  }
});

test("foreground recovery queues a worker without waiting on orphan controller requests", async () => {
  const f = fixture();
  await expect(startRun(f.deps, { root })).rejects.toThrow("Accepted workspace reply was lost");
  f.reveal();
  const ctx = f.context();
  const queued: string[] = [];
  const automation = {
    ...ctx.automation,
    enqueue: async (input: Parameters<typeof ctx.automation.enqueue>[0]) => {
      queued.push(typeof input.command === "string" ? input.command : input.command.id);
      return ctx.automation.enqueue(input);
    },
  };
  await resumeEnvironmentCleanups({ ...ctx, automation });
  expect(queued).toEqual(["environments.resume-cleanup"]);
  expect(f.calls.some((call) => call.includes("external_id"))).toBe(false);
  expect(f.workspace.state).toBe("ready");
});
