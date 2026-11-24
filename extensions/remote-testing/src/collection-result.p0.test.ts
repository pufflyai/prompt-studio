import { expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeCommandContext } from "@pstdio/sdk/testing";
import { collectRun, waitForCollection } from "./collection";
import { createRunStorage as createMemoryStorage } from "./run-storage-fixture";
import type { RunRecord } from "./runs";

test("a large log stays readable while the collection worker returns a small receipt", async () => {
  const root = await mkdtemp(join(tmpdir(), "remote-result-"));
  const log = JSON.stringify({ snapshot: "saved output ".repeat(10000) });
  const fetchTarget: { fetch: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch> } = globalThis;
  const download = spyOn(fetchTarget, "fetch").mockImplementation(async () => new Response(log));
  const store = createMemoryStorage();
  const record: RunRecord = {
    runId: "run",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    command: "bun test",
    root,
    startedAt: "2026-11-22T00:00:00Z",
    timeoutSeconds: 60,
    stopAfterRun: false,
  };
  await store.set("run:run", record);
  const ctx = makeCommandContext({
    storage: store,
    params: {},
    overrides: {
      settings: { all: async () => ({ templateVersion: "1", storageBucket: "fixture", signerAccount: "fixture" }) },
      connections: {
        request: async <T>() => ({
          status: 200,
          headers: {},
          body: {
            finalizedAt: "2026-11-22T00:00:00Z",
            acceptance: { execution: {} },
            outcome: { finalResponse: 'REMOTE_TEST_RESULT {"exitCode":0,"durationMs":10,"timedOut":false}' },
          } as T,
        }),
      },
      process: { run: async () => ({ exitCode: 0, stdout: "fixture-token", stderr: "" }) },
      extensionFiles: {
        writeText: async (path, text) => {
          await Bun.write(join(root, path), text);
        },
      },
      automation: {
        get: async () => ({
          id: "collector",
          projectId: "project",
          commandId: "runs.collect",
          status: "succeeded",
          createdAt: "2026-11-22T00:00:00Z",
          startedAt: null,
          finishedAt: null,
          result: { runId: "run" },
          error: null,
        }),
      },
    },
  });
  try {
    const result = await collectRun.run(ctx, { runId: "run" });
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(65536);
    const summary = await waitForCollection(ctx, "run", "collector");
    expect(summary).toMatchObject({ status: "passed", tail: log });
    expect(await Bun.file(join(root, "runs/run.log")).text()).toBe(log);
    expect(download).toHaveBeenCalledTimes(1);
  } finally {
    download.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});
