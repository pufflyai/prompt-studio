import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { makeWorkspace } from "../workspaces/workspace-provider.test-fixture";
import type { ExtensionsRouteDeps } from "./deps";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

export const createWorkspaceContextFixture = async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "workspace-context-")));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "context",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  await writeFile(
    join(root, "extension.ts"),
    `const provision = async (ctx, event) => {
      const cwd = (await ctx.process.run({
        command: [${JSON.stringify(process.execPath)}, "-e", "console.log(process.cwd())"],
      })).stdout.trim();
      await ctx.storage.set("provision-cwd", cwd);
      await ctx.workspaceFiles.writeText("provisioned.txt", cwd);
      await ctx.storage.set("provision-target", {
        cwd, event, workingText: await ctx.workspaceFiles.readText("notes.txt"),
        projectText: await ctx.projectFiles.readText("notes.txt"),
        defaultRoot: (await ctx.workspaces.getDefault()).root_path,
      });
    };
    export default {
    commands: [{ id: "inspect", ref: { kind: "command", id: "inspect" }, title: "Inspect",
      async run(ctx) {
        return { workspaceId: ctx.workspaceId ?? null, repoPath: ctx.repo?.path ?? null,
          text: ctx.workspaceFiles ? await ctx.workspaceFiles.readText("notes.txt") : null };
      } }],
    hooks: [{ id: "inspect", ref: { kind: "hook", id: "inspect" },
      event: { extensionId: "pstdio", kind: "event", id: "session.started" },
      async run(ctx, event) { await ctx.storage.set("delivered", {
        event, workspaceId: ctx.workspaceId ?? null,
        text: ctx.workspaceFiles ? await ctx.workspaceFiles.readText("notes.txt") : null,
      }); } },
      { id: "provision", ref: { kind: "hook", id: "provision" },
        event: { extensionId: "pstdio", kind: "event", id: "workspace.provision" },
        run: provision,
      },
      { id: "ready", ref: { kind: "hook", id: "ready" },
        event: { extensionId: "pstdio", kind: "event", id: "workspace.ready" },
        run: provision,
      }],
  };`,
  );
  await writeFile(join(root, "notes.txt"), "selected folder");
  const workspace = makeWorkspace({
    provider_id: "pstdio.root",
    execution_kind: "local",
    is_default: true,
    worktree_path: null,
    provider_params_json: {},
    provider_ref_json: null,
    provider_capabilities_json: {
      files: "write",
      diff: false,
      merge: false,
      rebase: false,
      archive: false,
      delete: false,
    },
  });
  const values = new Map<string, unknown>();
  const source = {
    instance: { id: "instance" },
    installedSource: {
      id: "source",
      extension_id: "example.context",
      source_kind: "local_path",
      source_path: root,
      status: "loaded",
    },
  };
  const repos = [{ id: "repo-1", path: root }];
  const deps = {
    workspaceService: { get: async () => workspace, getDefault: async () => workspace },
    repoService: { listByProject: async () => repos },
    projectService: { get: async () => ({ id: "project-1", name: "Project", shorthand: "P" }) },
    extensionService: { listEnabledSourcesForProject: async () => [source] },
    extensionStorageService: {
      getKv: async () => null,
      setKv: async (input: { key: string; value_json: unknown }) => {
        values.set(input.key, input.value_json);
      },
    },
    eventBus: { emit: () => {} },
  };
  return {
    root,
    workspace,
    values,
    repos,
    source,
    deps: {
      ...deps,
      extensionRuntimeCatalog: createProjectExtensionRuntimeCatalog(deps as never),
    } as unknown as ExtensionsRouteDeps,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
};
