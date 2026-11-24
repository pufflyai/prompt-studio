import { afterAll, beforeAll, expect, test } from "bun:test";
import { agentInfoSchema } from "pstdio-api-contracts";
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
      createTestHarnessRecord("local", {
        provider: {
          capabilities: () => ["Attachments", "SessionFork"],
          params: {
            mode: {
              type: "select",
              options: [{ value: "plan", label: "Plan", localizedLabel: { $l10n: "mode.plan", default: "Plan" } }],
            },
          },
        },
      }),
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
  const agents = agentInfoSchema.array().parse(await response.json());
  expect(agents).toEqual([
    expect.objectContaining({
      id: testHarnessId("local"),
      capabilities: ["Attachments", "SessionFork"],
      supportsModels: true,
      params: {
        mode: {
          type: "select",
          options: [{ value: "plan", label: "Plan", localizedLabel: { $l10n: "mode.plan", default: "Plan" } }],
        },
      },
    }),
    expect.objectContaining({ id: testHarnessId("remote"), capabilities: ["SessionReattach"], supportsModels: false }),
  ]);
});
