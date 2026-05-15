import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { CommandRunnerEnvironment, ExtensionDiagnostic } from "pstdio-extensions";
import { createCommandRunner, loadExtensionPackage, normalizeExtensionSources } from "pstdio-extensions";

const repoRoot = join(import.meta.dirname, "../../../../../..");

const loadWorktreeRuntime = async () => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage(
    { path: join(repoRoot, ".pstdio", "extensions", "worktree"), sourceKind: "local_path" },
    diagnostics,
  );
  expect(diagnostics).toEqual([]);
  if (!loaded) throw new Error("worktree extension failed to load");
  return normalizeExtensionSources([loaded], diagnostics);
};

const makeEnvironment = (removed: string[]): CommandRunnerEnvironment => ({
  storage: {
    scope: () => makeEnvironment(removed).storage,
    get: async () => undefined,
    set: async () => {},
    delete: async () => {},
    collection: () => ({
      get: async () => undefined,
      list: async () => [],
      put: async () => {},
      create: async (value) => ({ ...value, id: "" }),
      delete: async () => {},
    }),
  },
  artifacts: { mount: () => ({}) as never },
  files: {
    readText: async () => "",
    writeText: async () => {},
    createText: async () => ({ id: "" }),
    delete: async () => {},
  },
  sessions: {
    create: async () => ({ id: "" }),
    followup: async () => {},
  },
  workspaces: {
    get: async () => null,
    list: async () => [],
    create: async () => null,
    archive: async () => {},
    delete: async () => {},
    removeWorktree: async (id) => {
      removed.push(id);
      return { removed: true };
    },
  },
  repos: {
    list: async () => [],
    get: async () => ({}) as never,
    getDefault: async () => undefined,
    resolvePath: async (_repoId, relativePath) => relativePath,
  },
  activity: { record: async () => ({ id: "" }) },
  notify: { toast: async () => {} },
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  settings: {
    all: async () => ({}),
    get: async () => undefined,
    set: async () => {},
    delete: async () => {},
  },
});

describe("worktree repo-local extension", () => {
  test("removes worktrees from the ticket-scoped archive payload", async () => {
    const runtime = await loadWorktreeRuntime();
    expect(runtime.hooks.map((hook) => hook.eventId)).toContain("kernel.postTicketArchive");
    const removed: string[] = [];
    const runner = createCommandRunner(runtime, { buildEnvironment: () => makeEnvironment(removed) });

    const result = await runner.dispatch("kernel.postTicketArchive", {
      id: "ticket-1",
      shorthand: "PS-1",
      workspaces: [
        { id: "workspace-1", workspace_shorthand: "PS-1_A1", worktree_path: "/tmp/PS-1_A1" },
        { id: "workspace-2", workspace_shorthand: "PS-1_A2", worktree_path: null },
      ],
    });

    expect(result.diagnostics).toBeUndefined();
    expect(removed).toEqual(["workspace-1"]);
  });
});
