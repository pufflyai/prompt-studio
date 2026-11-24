import { expect, test } from "bun:test";
import { createRunStorage as createMemoryStorage } from "./run-storage-fixture";
import { listRuns, type RunRecord } from "./runs";

test("concurrent run records remain visible without a shared mutable index", async () => {
  const store = createMemoryStorage();
  const record = (runId: string): RunRecord => ({
    runId,
    environmentId: runId,
    requestId: runId,
    conversationId: runId,
    command: "bun test",
    root: "/workspace/repo",
    startedAt: "2026-01-01T00:00:00Z",
    timeoutSeconds: 60,
  });
  await Promise.all([store.set("run:first", record("first")), store.set("run:second", record("second"))]);
  await store.set("unrelated", { runId: "not-a-run" });
  expect((await listRuns(store)).map((run) => run.runId).sort()).toEqual(["first", "second"]);
});
