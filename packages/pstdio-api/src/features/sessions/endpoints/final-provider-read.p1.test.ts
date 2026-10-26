import { expect, test } from "bun:test";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../../features/harnesses/test-harness-registry";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";

test("draft discovery tolerates replacement after the final provider lookup", async () => {
  let gets = 0;
  let refresh = false;
  const record = (name: string) =>
    createTestHarnessRecord("commands", {
      provider: {
        getCommandState: () => ({ slashCommands: true, modes: [], commands: [{ name, description: name }] }),
      },
    });
  const original = createTestHarnessRegistry([record("/old")]);
  const replacement = createTestHarnessRegistry([record("/current")]);
  let current = original;
  const registry = {
    get: async (...args: Parameters<typeof original.get>) => {
      const handle = await current.get(...args);
      if (refresh && ++gets === 4) {
        queueMicrotask(() => {
          current = replacement;
          void original.dispose();
        });
      }
      return handle;
    },
    list: (...args: Parameters<typeof original.list>) => current.list(...args),
    retainSession: (id: string) => current.retainSession(id),
    invalidate() {},
    dispose: async () => {
      await original.dispose();
      await replacement.dispose();
    },
  };
  const app = await createTestApp({ harnessRegistry: registry });
  try {
    const project = await (
      await app.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Refresh race" })),
      })
    ).json();
    refresh = true;
    const response = await app.app.request("/v1/sessions/harness-command-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, agent: testHarnessId("commands") }),
    });
    const body = await response.json();
    expect({ status: response.status, body }).toMatchObject({
      status: 200,
      body: { commands: [{ name: "/current", description: "/current" }] },
    });
  } finally {
    await app.close();
  }
});
