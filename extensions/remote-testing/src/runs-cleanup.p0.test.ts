import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { checkRun, type RunRecord } from "./runs";

function finishedRun(stopAfterRun: boolean) {
  const apiCalls: string[] = [];
  const record = {
    runId: "test",
    environmentId: "env",
    requestId: "request",
    conversationId: "conversation",
    command: "bun test",
    root: "/",
    startedAt: new Date().toISOString(),
    timeoutSeconds: 30,
    stopAfterRun,
  } satisfies RunRecord;
  const deps = {
    store: createMemoryStorage(),
    async api({ method, path }) {
      apiCalls.push(`${method} ${path}`);
      if (method === "POST") return { state: "terminating" } as never;
      return {
        finalizedAt: new Date().toISOString(),
        acceptance: { execution: {} },
        outcome: { finalResponse: 'REMOTE_TEST_RESULT {"exitCode":1,"durationMs":100,"timedOut":false}' },
      } as never;
    },
    storage: {
      async download() {
        return new Uint8Array();
      },
    },
    async saveLog() {
      return "test.log";
    },
  } satisfies Parameters<typeof checkRun>[0];
  return { deps, record, apiCalls };
}

test("completed runs stop the environment by default even when the suite fails", async () => {
  const { deps, record, apiCalls } = finishedRun(true);
  const result = await checkRun(deps, record);
  expect(result?.status).toBe("failed");
  expect(apiCalls).toContain("POST /v1/workspaces/env/cancel");
  expect(await deps.store.get(`run:${record.runId}`)).toMatchObject({ summary: { status: "failed" } });
});

test("an explicit request to keep the environment preserves it", async () => {
  const { deps, record, apiCalls } = finishedRun(false);
  expect((await checkRun(deps, record))?.status).toBe("failed");
  expect(apiCalls.length).toBe(1);
});
