import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let tempRoot: string;
const effort = {
  type: "select" as const,
  defaultValue: "medium",
  options: [
    { label: "Medium", value: "medium" },
    { label: "High", value: "high" },
  ],
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "harness-param-defaults-"));
  handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("effort", {
        provider: {
          params: { effort },
          listModels: () => [
            { id: "high-default", paramOverrides: { effort: { ...effort, defaultValue: "high" } } },
            { id: "no-effort", paramOverrides: { effort: null } },
          ],
        },
      }),
    ]),
  });
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

test("reads model defaults while keeping explicitly configured project parameters", async () => {
  const response = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name: "Model defaults" })),
  });
  const project = await response.json();
  const path = `/v1/projects/${project.id}/harnesses/${encodeURIComponent(testHarnessId("effort"))}/params`;
  const initial = await handle.app.request(`${path}?model=high-default`);
  expect(initial.status).toBe(200);
  expect((await initial.json()).defaults).toEqual({ effort: "high" });

  const configured = await handle.app.request(path, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ params: { effort: "medium" } }),
  });
  expect(configured.status).toBe(200);
  const restored = await handle.app.request(`${path}?model=high-default`);
  expect((await restored.json()).defaults).toEqual({ effort: "medium" });
  const disabled = await handle.app.request(`${path}?model=no-effort`);
  expect(await disabled.json()).toEqual({ schema: {}, defaults: {} });
});
