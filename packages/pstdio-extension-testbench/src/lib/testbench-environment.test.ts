import { expect, test } from "bun:test";
import { createBenchEnvironment } from "./testbench-environment";

test("queued requests explain their host runtime requirement in the testbench", async () => {
  const { sessions } = createBenchEnvironment();
  await expect(sessions.getQueuedFollowUps("session")).rejects.toThrow("host runtime");
  await expect(sessions.updateQueuedFollowUp("session", 1, { prompt: "Update request" })).rejects.toThrow(
    "host runtime",
  );
  await expect(
    sessions.combineQueuedFollowUps("session", 1, {
      sourcePosition: 2,
      sourceRevision: "source-revision",
      targetRevision: "target-revision",
    }),
  ).rejects.toThrow("host runtime");
  await expect(
    sessions.steerQueuedFollowUp("session", 1, {
      expectedRevision: "revision",
      expectedRunStartedAt: "run-start",
    }),
  ).rejects.toThrow("host runtime");
});
