import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("draft discovery uses the current provider when a refresh finishes during model discovery", async () => {
  let refresh = false;
  const replacement = createTestHarnessRegistry([
    createTestHarnessRecord("commands", {
      provider: {
        getCommandState: () => ({
          slashCommands: true,
          commands: [{ name: "/current", description: "Current commands" }],
          modes: [],
        }),
      },
    }),
  ]);
  const original = createTestHarnessRegistry([
    createTestHarnessRecord("commands", {
      provider: {
        listModels: async () => {
          if (refresh) {
            current = replacement;
            await original.dispose();
          }
          return [];
        },
        getCommandState: () => ({
          slashCommands: true,
          commands: [{ name: "/old", description: "Previous commands" }],
          modes: [],
        }),
      },
    }),
  ]);
  let current = original;
  const registry = {
    retainSession: (id: string) => current.retainSession(id),
    get: (...args: Parameters<typeof current.get>) => current.get(...args),
    list: (...args: Parameters<typeof current.list>) => current.list(...args),
    invalidate: () => {},
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
        body: JSON.stringify(folderProjectInput({ name: "Provider refresh" })),
      })
    ).json();
    refresh = true;
    const response = await app.app.request("/v1/sessions/harness-command-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, agent: testHarnessId("commands") }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).commands).toMatchObject([{ name: "/current" }]);
  } finally {
    await app.close();
  }
});
