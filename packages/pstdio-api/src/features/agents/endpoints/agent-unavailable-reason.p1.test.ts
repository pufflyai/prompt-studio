import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const reason = "Example 0.1.0 is too old. Update Example to 0.2.0 or newer.";
let handle: Awaited<ReturnType<typeof createTestApp>>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "agent-unavailable-reason-"));
  handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("outdated", {
        provider: { detect: () => ({ available: false, version: "0.1.0", reason }) },
      }),
    ]),
  });
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

test("lists an unavailable harness with the reason it gives", async () => {
  const response = await handle.app.request("/v1/agents/info");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([
    expect.objectContaining({ id: testHarnessId("outdated"), availability: { type: "NOT_FOUND", reason } }),
  ]);
});

test("reports the reason when checking one harness", async () => {
  const response = await handle.app.request(`/v1/agents/availability?agent=${testHarnessId("outdated")}`);
  expect(await response.json()).toEqual({ type: "NOT_FOUND", reason });
});
