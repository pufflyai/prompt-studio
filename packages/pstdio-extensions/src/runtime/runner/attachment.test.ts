import { describe, expect, test } from "bun:test";
import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
import { normalizeExtensionSources } from "../normalize";
import { type CommandRunnerEnvironment, createCommandRunner } from "./runner";

const storage: CommandRunnerEnvironment["storage"] = {
  scope: () => storage,
  files: {
    put: async () => ({}) as never,
    get: async () => undefined,
    getBytes: async () => new Uint8Array(),
    list: async () => [],
    delete: async () => {},
    urlFor: () => "",
  },
  get: async () => undefined,
  set: async () => {},
  delete: async () => {},
  collection: () => {
    throw new Error("collection not implemented in test");
  },
};

const createSessionResource = () => ({ type: "session" as const, id: "", title: "", status: "in_progress" as const });

const environment: CommandRunnerEnvironment = {
  project: { id: "project-1", name: "Project One", shorthand: "PO" },
  storage,
  artifacts: { mount: () => ({}) as never },
  files: {
    readText: async () => "",
    writeText: async () => {},
    createText: async () => ({ id: "" }),
    delete: async () => {},
  },
  sessions: {
    get: async () => null,
    list: async () => [],
    create: async () => createSessionResource(),
    followup: async () => {},
  },
  workspaces: {
    list: async () => [],
    get: async () => null,
    getByShorthand: async () => null,
    create: async () => ({ id: "" }),
    archive: async () => {},
    delete: async () => {},
  },
  worktrees: { bootstrap: async () => {} },
  repos: {
    list: async () => [],
    get: async () => ({}) as never,
    getDefault: async () => undefined,
    resolvePath: async (_repoId, relativePath) => relativePath,
  },
  activity: { record: async () => ({ id: "" }) },
  notify: {
    toast: async () => {},
    action: async () => ({}) as never,
    resolve: async () => [],
    dismiss: async () => [],
  },
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  settings: { all: async () => ({}), get: async () => undefined, set: async () => {}, delete: async () => {} },
};

const makeRunner = (definition: ExtensionDefinition) => {
  const runtime = normalizeExtensionSources([
    {
      packagePath: "/tmp/lab",
      sourcePath: "/tmp/lab/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "pstdio.lab",
        name: "lab",
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        enginesPstdio: "^1.0.0",
      },
      definition,
    },
  ]);

  return createCommandRunner(runtime, { buildEnvironment: () => environment });
};

describe("createCommandRunner attachment context", () => {
  test("exposes workbench attachment context to command handlers", async () => {
    const runner = makeRunner({
      commands: {
        inspect: {
          title: "Inspect",
          run: async (ctx) => ({
            attachment: ctx.attachment,
            invocationAttachment: ctx.invocation.attachment,
          }),
        },
      },
    });

    const outcome = await runner.execute({
      commandId: "lab.inspect",
      projectId: "project-1",
      attachment: {
        target: "workbench.nav.actions",
        mode: "workspace",
        projectId: "project-1",
        resource: { type: "workspace", id: "workspace-1", label: "Workspace 1" },
      },
    });

    expect(outcome).toEqual({
      ok: true,
      status: "success",
      value: {
        attachment: {
          target: "workbench.nav.actions",
          mode: "workspace",
          projectId: "project-1",
          resource: { type: "workspace", id: "workspace-1", label: "Workspace 1" },
        },
        invocationAttachment: {
          target: "workbench.nav.actions",
          mode: "workspace",
          projectId: "project-1",
          resource: { type: "workspace", id: "workspace-1", label: "Workspace 1" },
        },
      },
    });
  });
});
