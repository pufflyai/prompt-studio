import { expect, test } from "bun:test";
import { createBenchEnvironment } from "./testbench-environment";

test("testbench commands stage and read isolated immutable assets", async () => {
  const { storage } = createBenchEnvironment();
  const asset = await storage.assets.stage({ operationId: "preview", source: new Blob(["bench asset"]) });
  await storage.assets.verifyComplete([asset]);
  expect(await new Response(await storage.assets.read(asset)).text()).toBe("bench asset");
  expect(await storage.assets.getTransfer("preview")).toMatchObject({ status: "complete", asset });
  expect(await createBenchEnvironment().storage.assets.getTransfer("preview")).toBeUndefined();
});

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
