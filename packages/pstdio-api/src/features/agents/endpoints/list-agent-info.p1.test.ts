import { afterAll, beforeAll, expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

let handle: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  handle = await createTestApp({
    databasePath: ":memory:",
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("local", { provider: { capabilities: () => ["Attachments", "SessionFork"] } }),
      createTestHarnessRecord("remote", {
        provider: { capabilities: () => ["SessionReattach"], listModels: undefined },
      }),
    ]),
  });
});

afterAll(async () => {
  await handle.close();
});

test("lists each harness's capabilities and whether it offers models", async () => {
  const response = await handle.app.request("/v1/agents/info");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([
    expect.objectContaining({
      id: testHarnessId("local"),
      capabilities: ["Attachments", "SessionFork"],
      supportsModels: true,
    }),
    expect.objectContaining({ id: testHarnessId("remote"), capabilities: ["SessionReattach"], supportsModels: false }),
  ]);
});
