import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderWorkspaceCapabilities } from "pstdio-db";
import { createFilesApi } from "./files";
import { createCommandEnvironment } from "./index";
import { createSessionsApi } from "./sessions";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const makeEnabledSources = () => [
  {
    instance: {
      id: "instance-1",
      namespace: "lab",
    },
    installedSource: {
      id: "source-1",
      extension_id: "pstdio.extension-lab",
      source_path: "/tmp/extension-lab",
    },
  },
];

const projectContext = { id: "project-1", name: "Project One", shorthand: "PO" };

const makeStorageService = () => ({
  getKv: async () => null,
  setKv: async () => {},
  deleteKv: async () => {},
  getCollectionItem: async () => null,
  listCollection: async () => [],
  setCollectionItem: async () => {},
  deleteCollectionItem: async () => {},
});

const terminalHandle = {
  id: "session-1",
  write: () => {},
  resize: () => {},
  kill: async () => {},
  events: async function* () {},
};

const labSettings = [
  {
    id: "extension-lab.counter.step",
    key: "counter.step",
    extensionId: "pstdio.extension-lab",
    name: "extension-lab",
    sourcePath: "/tmp/extension-lab/extension.ts",
    contribution: { type: "number", scope: "project", default: 1 },
  },
  {
    id: "extension-lab.greeting.tone",
    key: "greeting.tone",
    extensionId: "pstdio.extension-lab",
    name: "extension-lab",
    sourcePath: "/tmp/extension-lab/extension.ts",
    contribution: { type: "string", scope: "global", enum: ["friendly", "formal"], default: "friendly" },
  },
] as const;

const makeSettingsService = () => {
  const values = new Map<string, unknown>();
  const keyOf = (input: { installedExtensionId: string; extensionInstanceId: string }, key: string) =>
    `${input.installedExtensionId}\0${input.extensionInstanceId}\0${key}`;

  return {
    async list(context: { installedExtensionId: string; extensionInstanceId: string }) {
      return labSettings.map((setting) => ({
        key: setting.key,
        value: values.get(keyOf(context, setting.key)) ?? setting.contribution.default,
      }));
    },
    async get(context: { installedExtensionId: string; extensionInstanceId: string }, key: string) {
      const setting = labSettings.find((candidate) => candidate.key === key);
      if (!setting) throw Object.assign(new Error("unknown"), { code: "extension_setting_unknown_key" });
      return { key, value: values.get(keyOf(context, key)) ?? setting.contribution.default };
    },
    async set(context: { installedExtensionId: string; extensionInstanceId: string }, key: string, value: unknown) {
      const setting = labSettings.find((candidate) => candidate.key === key);
      if (!setting) throw Object.assign(new Error("unknown"), { code: "extension_setting_unknown_key" });
      if (setting.contribution.type === "number" && typeof value !== "number") {
        throw Object.assign(new Error("invalid"), { code: "extension_setting_invalid" });
      }
      if (setting.contribution.type === "string" && typeof value !== "string") {
        throw Object.assign(new Error("invalid"), { code: "extension_setting_invalid" });
      }
      values.set(keyOf(context, key), value);
      return { key, value };
    },
    async delete(context: { installedExtensionId: string; extensionInstanceId: string }, key: string) {
      values.delete(keyOf(context, key));
    },
  };
};

describe("createCommandEnvironment host primitives", () => {
  test("separates read-only package files from allocated repo files", async () => {
    const sourcePath = mkdtempSync(join(tmpdir(), "pstdio-extension-files-"));
    const repoPath = mkdtempSync(join(tmpdir(), "pstdio-extension-repo-files-"));
    tempRoots.push(sourcePath);
    tempRoots.push(repoPath);
    writeFileSync(join(sourcePath, "guide.md"), "# Guide");
    const enabledSources = makeEnabledSources();
    enabledSources[0]!.installedSource.source_path = sourcePath;
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: {
          setInitializing: async () => null,
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: repoPath,
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
            provider_capabilities_json: folderWorkspaceCapabilities,
          }),
        },
      } as never,
      enabledSources as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    expect(await env.packageFiles.readText("guide.md")).toBe("# Guide");
    expect("writeText" in env.packageFiles).toBe(false);
    await env.extensionFiles?.writeText("cache/index.json", "{}");
    expect(readFileSync(join(repoPath, ".pstdio/ext/pstdio.extension-lab/cache/index.json"), "utf8")).toBe("{}");
    expect(readFileSync(join(repoPath, ".pstdio/.gitignore"), "utf8")).toContain("/ext/pstdio.extension-lab/");
    await expect(env.extensionFiles?.readText("../secret.md")).rejects.toThrow("escapes");
  });

  test("defaults terminal sessions to the workspace directory", () => {
    const requests: unknown[] = [];
    const terminal = {
      openSession: (request: unknown) => {
        requests.push(request);
        return terminalHandle;
      },
    };

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        terminal,
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
        workspaceDir: "/workspace/current",
      },
    );

    if (!env.terminal) throw new Error("expected terminal to be present");
    expect(env.terminal.openSession({ command: ["pwd"], cols: 80, rows: 24 })).toBe(terminalHandle);
    expect(requests).toEqual([{ command: ["pwd"], cols: 80, rows: 24, cwd: "/workspace/current" }]);
  });

  test("preserves explicit terminal session cwd", () => {
    const requests: unknown[] = [];
    const terminal = {
      openSession: (request: unknown) => {
        requests.push(request);
        return terminalHandle;
      },
    };

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        terminal,
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
        workspaceDir: "/workspace/current",
      },
    );

    if (!env.terminal) throw new Error("expected terminal to be present");
    env.terminal.openSession({ command: ["pwd"], cols: 80, rows: 24, cwd: "/tmp/other" });

    expect(requests).toEqual([{ command: ["pwd"], cols: 80, rows: 24, cwd: "/tmp/other" }]);
  });

  test("lists the project workspaces from extension context helpers", async () => {
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: {
          setInitializing: async () => null,
          list: async (projectId: string) => [
            { id: "ws-1", project_id: projectId },
            { id: "ws-2", project_id: projectId },
          ],
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    await expect(env.workspaces.list()).resolves.toEqual([
      { id: "ws-1", project_id: "project-1" },
      { id: "ws-2", project_id: "project-1" },
    ]);
  });

  test("exposes project files through the default workspace", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-repo-files-test-"));
    tempRoots.push(root);

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),

        workspaceService: {
          setInitializing: async () => null,
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: root,
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
            provider_capabilities_json: folderWorkspaceCapabilities,
          }),
          list: async () => [],
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    if (!env.projectFiles) throw new Error("expected projectFiles to be present");
    await env.projectFiles.writeText(".pstdio/tickets/PS-1/ticket.md", "# hi");

    expect(readFileSync(join(root, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8")).toBe("# hi");
    expect(await env.projectFiles.readText(".pstdio/tickets/PS-1/ticket.md")).toBe("# hi");
    await expect(env.projectFiles.writeText("../escape.md", "x")).rejects.toThrow(/escapes/);
  });

  test("separates default project files from selected workspace files", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-repo-root-"));
    const worktreeRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-worktree-"));
    tempRoots.push(repoRoot, worktreeRoot);

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),

        workspaceService: {
          setInitializing: async () => null,
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: repoRoot,
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
            provider_capabilities_json: folderWorkspaceCapabilities,
          }),
          get: async () => ({
            id: "ws-1",
            project_id: "project-1",
            root_path: worktreeRoot,
            execution_kind: "local",
            provider_state: "ready",
            provider_capabilities_json: folderWorkspaceCapabilities,
          }),
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
        workspaceDir: worktreeRoot,
        workspaceId: "ws-1",
      },
    );

    if (!env.projectFiles) throw new Error("expected projectFiles to be present");
    await env.projectFiles.writeText(".pstdio/tickets/PS-1/ticket.md", "# project");
    await env.workspaceFiles!.writeText(".pstdio/tickets/PS-1/ticket.md", "# wt");

    expect(readFileSync(join(worktreeRoot, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8")).toBe("# wt");
    expect(readFileSync(join(repoRoot, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8")).toBe("# project");
  });
});

describe("createCommandEnvironment storage scopes", () => {
  test("rejects storage scopes that are missing their required id", () => {
    const env = createCommandEnvironment(
      { extensionStorageService: makeStorageService() } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    expect(() => env.storage.scope({ type: "resource" } as never)).toThrow(
      "resource storage scope requires resource.id",
    );
    expect(() => env.storage.scope({ type: "custom" } as never)).toThrow("custom storage scope requires id");
  });
});

describe("createCommandEnvironment session scopes", () => {
  test("does not read or mutate sessions, workspaces, or repos from another project", async () => {
    const listByWorkspace = mock(async () => []);
    const updateSession = mock(async () => null);
    const foreignSession = {
      id: "session-foreign",
      project_id: "project-2",
      cwd: "/foreign",
      anchors_json: [],
    };
    const sessions = createSessionsApi(
      {
        sessionService: {
          get: async () => foreignSession,
          list: async () => [],
          update: updateSession,
        },
        workspaceService: {
          setInitializing: async () => null,
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: "/local",
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
            provider_capabilities_json: folderWorkspaceCapabilities,
          }),
          get: async () => ({ id: "workspace-foreign", project_id: "project-2" }),
          getByShorthand: async () => null,
        },
        workspaceSessionService: { listByWorkspace },
      } as never,
      { project: projectContext, projectId: "project-1" },
    );

    await expect(sessions.get("session-foreign")).resolves.toBeNull();
    await expect(sessions.listByWorkspace("workspace-foreign")).rejects.toThrow(
      "Workspace not found: workspace-foreign",
    );
    await expect(sessions.create({ title: "Forged", prompt: "x", workspaceId: "workspace-foreign" })).rejects.toThrow(
      "Workspace not found: workspace-foreign",
    );
    await expect(
      sessions.create({ title: "Forged", prompt: "x", originalSessionId: "session-foreign" }),
    ).rejects.toThrow("Session not found: session-foreign");
    await expect(sessions.followup({ sessionId: "session-foreign", prompt: "x" })).rejects.toThrow(
      "Session not found: session-foreign",
    );
    await expect(sessions.addAnchors("session-foreign", [])).rejects.toThrow("Session not found: session-foreign");
    expect(listByWorkspace).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });
});

describe("createCommandEnvironment file scopes", () => {
  test("does not read, overwrite, or delete a file from another project", async () => {
    const update = mock(async () => null);
    const remove = mock(async () => false);
    const files = createFilesApi(
      {
        fileService: {
          get: async () => ({ id: "file-foreign", project_id: "project-2", storage_path: "/foreign" }),
          update,
          remove,
        },
      } as never,
      "project-1",
    );

    await expect(files.readText("file-foreign")).rejects.toThrow("File not found: file-foreign");
    await expect(files.writeText("file-foreign", "changed")).rejects.toThrow("File not found: file-foreign");
    await expect(files.delete("file-foreign")).rejects.toThrow("File not found: file-foreign");
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("createCommandEnvironment", () => {
  test("finds enabled sources by extension id when stored namespace is stale", () => {
    expect(() =>
      createCommandEnvironment(
        { extensionStorageService: makeStorageService() } as never,
        makeEnabledSources() as never,
        {
          extensionId: "pstdio.extension-lab",
          name: "extension-lab",
          project: projectContext,
          projectId: "project-1",
        },
      ),
    ).not.toThrow();
  });

  test("runs process commands that must succeed", async () => {
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: {
          getDefault: async () => ({
            project_id: "project-1",
            root_path: process.cwd(),
            execution_kind: "local",
            provider_state: "ready",
          }),
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    const result = await env.process.runOrThrow({
      command: ["bun", "-e", "console.log('ok')"],
    });

    expect(result.stdout.trim()).toBe("ok");
    await expect(
      env.process.runOrThrow({
        command: ["bun", "-e", "console.error('nope'); process.exit(7)"],
      }),
    ).rejects.toThrow("nope");
  });

  test("mounts declared artifact roots under the default repo", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-artifact-mount-test-"));
    tempRoots.push(root);
    const repoPath = join(root, "repo");
    mkdirSync(repoPath, { recursive: true });

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: {
          setInitializing: async () => null,
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: repoPath,
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
            provider_capabilities_json: folderWorkspaceCapabilities,
          }),
        },
      } as never,
      makeEnabledSources() as never,
      {
        artifactMounts: [
          {
            id: "extension-lab.reports",
            localId: "reports",
            extensionId: "pstdio.extension-lab",
            name: "extension-lab",
            sourcePath: "/tmp/extension-lab/extension.ts",
            relativePath: "reports",
            fullPath: ".pstdio/extension-storage/extension-lab/reports",
            label: "Reports",
          },
        ],
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    const reports = env.artifacts.mount("reports");
    await reports.writeText("latest.md", "hello");

    expect(
      readFileSync(join(repoPath, ".pstdio", "extension-storage", "extension-lab", "reports", "latest.md"), "utf8"),
    ).toBe("hello");
    expect(() => env.artifacts.mount("missing")).toThrow("Artifact mount not found: missing");
  });
});

describe("createCommandEnvironment workspaces", () => {
  test("creates anchored workspaces from extension context helpers", async () => {
    const created: unknown[] = [];
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),

        workspaceService: {
          setInitializing: async () => null,
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: "/repo",
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
          }),
          create: async (input: unknown) => {
            created.push(input);
            return { id: "ws-1", workspace_shorthand: "T-1_A1", anchors_json: [], ...(input as object) };
          },
          updateProviderOperationProjection: async (id: string, input: { patch: unknown }) => ({
            id,
            workspace_shorthand: "T-1_A1",
            anchors_json: [],
            ...(input.patch as object),
          }),
        },
        eventBus: { emit: () => {} },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
      {
        runWorkspaceProvisioning: async (_deps, input) => input.workspace,
        setupWorkspaceWorktree: async () => ({
          branch: "workspace/T-1_A1",
          worktreePath: "/repo/.worktrees/T-1_A1",
          rootPath: "/repo/.worktrees/T-1_A1",
          sourceRoot: "/repo",
          relativePath: "",
        }),
      },
    );

    const workspace = await env.workspaces.create({
      shorthand_base: "T-1",
      provider_id: "pstdio.worktree",
      anchors: [{ type: "ticket", id: "ticket-1", label: "T-1", metadata: { shorthand: "T-1" } }],
    });

    expect(workspace).toMatchObject({ id: "ws-1" });
    expect(created).toEqual([
      expect.objectContaining({
        project_id: "project-1",
        shorthand_base: "T-1",
        provider_id: "pstdio.worktree",
        provider_operation_kind: "create",
        anchors: [{ type: "ticket", id: "ticket-1", label: "T-1", metadata: { shorthand: "T-1" } }],
      }),
    ]);
  });

  test("resolves workspaces by shorthand from extension context helpers", async () => {
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: {
          setInitializing: async () => null,
          getByShorthand: async (projectId: string, shorthand: string) => ({
            id: "ws-1",
            project_id: projectId,
            workspace_shorthand: shorthand,
          }),
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    await expect(env.workspaces.getByShorthand("PS-1_A1")).resolves.toEqual({
      id: "ws-1",
      project_id: "project-1",
      workspace_shorthand: "PS-1_A1",
    });
  });

  test("resolves a ref-less default workspace as a local execution target", async () => {
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),

        workspaceService: {
          setInitializing: async () => null,
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: "/repo",
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
          }),
          get: async () => ({
            id: "default",
            project_id: "project-1",
            provider_id: "pstdio.root",
            provider_ref_json: null,
            provider_state: "ready",
            execution_kind: "local",
            root_path: "/repo",
            display_path: null,
            provider_capabilities_json: {
              files: "write",
              diff: false,
              merge: false,
              rebase: false,
              archive: false,
              delete: false,
            },
            provider_error_json: null,
            is_default: true,
          }),
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    await expect(env.workspaces.resolve("default")).resolves.toMatchObject({
      state: "ready",
      executionKind: "local",
      executionTarget: { kind: "local", rootPath: "/repo" },
    });
  });
});

describe("createCommandEnvironment workspace lifecycle", () => {
  test("archive cascades to the workspace's active sessions", async () => {
    const archivedWorkspaces: string[] = [];
    const archivedSessions: string[] = [];
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),

        workspaceService: {
          setInitializing: async () => null,
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: "/repo",
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
          }),
          get: async (id: string) => ({
            id,
            project_id: "project-1",
            workspace_shorthand: "T-1_A1",
            branch: null,
            root_path: null,
            provider_id: "pstdio.worktree",
            provider_ref_json: null,
            execution_kind: "local",
            provider_capabilities_json: {
              files: "write",
              diff: true,
              merge: true,
              rebase: true,
              archive: true,
              delete: true,
            },
            display_path: null,
            archived: false,
          }),
          archive: async (id: string) => {
            archivedWorkspaces.push(id);
            return { id, archived: true };
          },
          updateProviderProjection: async (id: string, patch: unknown) => ({
            id,
            archived: true,
            ...(patch as object),
          }),
        },
        workspaceSessionService: {
          listByWorkspace: async () => [
            { id: "session-1", archived: false },
            { id: "session-2", archived: true },
          ],
        },
        sessionService: {
          archive: async (id: string) => {
            archivedSessions.push(id);
          },
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    await env.workspaces.archive("ws-1");

    expect(archivedWorkspaces).toEqual(["ws-1"]);
    expect(archivedSessions).toEqual(["session-1"]);
  });

  test("fires worktree.removed after extension-initiated deletion", async () => {
    const softDelete = mock(async () => {});
    const remove = mock(async () => true);
    const fireRemoved = mock(() => {});
    const workspace = {
      id: "ws-1",
      project_id: "project-1",
      workspace_shorthand: "T-1_A1",
      anchors_json: [],
      branch: "workspace/T-1_A1",
      root_path: "/repo/.worktrees/T-1_A1",
      provider_id: "pstdio.worktree",
      provider_capabilities_json: { archive: true, delete: true },
      provider_ref_json: null,
      provider_state: "ready",
      execution_kind: "local",
      is_default: false,
    };
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: { setInitializing: async () => null, get: async () => workspace, softDelete },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
      {
        deleteProviderBackedWorkspace: remove as never,
        fireExtensionEventAsync: fireRemoved as never,
        runWorkspaceProvisioning: async (_deps, input) => input.workspace,
        setupWorkspaceWorktree: async () => ({
          branch: "unused",
          worktreePath: "/unused",
          rootPath: "/unused",
          sourceRoot: "/repo",
          relativePath: "",
        }),
      },
    );

    await env.workspaces.delete("ws-1");

    expect(remove).toHaveBeenCalledTimes(1);
    expect(softDelete).toHaveBeenCalledWith("ws-1");
    expect(fireRemoved).toHaveBeenCalledWith(
      expect.anything(),
      "project-1",
      expect.objectContaining({ id: "worktree.removed" }),
      expect.objectContaining({ workspaceId: "ws-1", worktreePath: workspace.root_path }),
    );
  });

  test("removes a worktree without deleting its workspace", async () => {
    const softDelete = mock(async () => {});
    const cleanup = mock(async () => true);
    const fireRemoved = mock(() => {});
    const workspace = {
      id: "ws-1",
      project_id: "project-1",
      workspace_shorthand: "T-1_A1",
      anchors_json: [],
      branch: "workspace/T-1_A1",
      root_path: "/repo/.worktrees/T-1_A1",
      provider_id: "pstdio.worktree",
      provider_ref_json: null,
      provider_state: "ready",
      execution_kind: "local",
    };
    const clearWorktree = mock(async () => ({ ...workspace, branch: null, root_path: null }));
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: { setInitializing: async () => null, clearWorktree, get: async () => workspace, softDelete },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
      {
        cleanupWorkspaceWorktree: cleanup as never,
        fireExtensionEventAsync: fireRemoved as never,
        runWorkspaceProvisioning: async (_deps, input) => input.workspace,
        setupWorkspaceWorktree: async () => ({
          branch: "unused",
          worktreePath: "/unused",
          rootPath: "/unused",
          sourceRoot: "/repo",
          relativePath: "",
        }),
      },
    );

    await expect(env.workspaces.removeWorktree("ws-1")).resolves.toEqual({ removed: true });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(clearWorktree).toHaveBeenCalledWith("ws-1");
    expect(softDelete).not.toHaveBeenCalled();
    expect(fireRemoved).toHaveBeenCalledWith(
      expect.anything(),
      "project-1",
      expect.objectContaining({ id: "worktree.removed" }),
      expect.objectContaining({ workspaceId: "ws-1", worktreePath: workspace.root_path }),
    );
  });

  test("does not expose or mutate a workspace owned by another project", async () => {
    const cleanup = mock(async () => true);
    const softDelete = mock(async () => {});
    const workspace = {
      id: "other-workspace",
      project_id: "project-2",
      workspace_shorthand: "OTHER_A1",
      anchors_json: [],
      branch: "workspace/OTHER_A1",
      root_path: "/repo/.worktrees/OTHER_A1",
      provider_id: "pstdio.worktree",
      provider_ref_json: null,
      provider_state: "ready",
      execution_kind: "local",
    };
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: { setInitializing: async () => null, get: async () => workspace, softDelete },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
      {
        cleanupWorkspaceWorktree: cleanup as never,
        runWorkspaceProvisioning: async (_deps, input) => input.workspace,
        setupWorkspaceWorktree: async () => ({
          branch: "unused",
          worktreePath: "/unused",
          rootPath: "/unused",
          sourceRoot: "/repo",
          relativePath: "",
        }),
      },
    );

    await expect(env.workspaces.get("other-workspace")).resolves.toBeNull();
    await expect(env.workspaces.removeWorktree("other-workspace")).rejects.toThrow(
      "Workspace not found: other-workspace",
    );
    await expect(env.workspaces.delete("other-workspace")).rejects.toThrow("Workspace not found: other-workspace");
    expect(cleanup).not.toHaveBeenCalled();
    expect(softDelete).not.toHaveBeenCalled();
  });
});

describe("createCommandEnvironment project boundaries", () => {
  test("queues remote session follow-ups without a local cwd", async () => {
    const inserted: unknown[] = [];
    const session = {
      id: "session-1",
      project_id: "project-1",
      status: "in_progress",
      agent: "fake",
      agent_session_id: "agent-session-1",
      cwd: null,
      last_selected_model: null,
    };
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        sessionService: {
          get: async () => session,
          insertEntryForActive: async (input: unknown) => {
            inserted.push(input);
            return { queue_position: 1 };
          },
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    await env.sessions.followup({ sessionId: "session-1", prompt: "continue" });

    expect(inserted).toEqual([
      {
        id: "session-1",
        prompt: "continue",
        request_kind: "follow_up",
        question_response_json: null,
      },
    ]);
  });

  test("allocates a real free port", async () => {
    const env = createCommandEnvironment(
      { extensionStorageService: makeStorageService() } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    const port = await env.net.findFreePort();

    expect(port).toBeGreaterThan(0);
  });
});

describe("createCommandEnvironment storage files", () => {
  test("exposes extension-owned blob storage to command handlers", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-storage-files-test-"));
    tempRoots.push(root);
    const files = new Map<
      string,
      {
        id: string;
        project_id: string;
        file_name: string;
        file_kind: string;
        storage_path: string;
        mime_type: string | null;
        size_bytes: number;
        hash: string | null;
        created_at: string;
        updated_at: string;
      }
    >();
    const uploaded: unknown[] = [];
    const removed: unknown[] = [];

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        extensionFileService: {
          upload: async (input: {
            data: Buffer;
            extension_instance_id: string;
            file_name: string;
            mime_type?: string | null;
            project_id: string;
            scope_id: string | null;
            scope_type: string;
          }) => {
            uploaded.push(input);
            const id = `file-${(files.size + 1).toString()}`;
            const storagePath = join(root, id);
            writeFileSync(storagePath, input.data);
            const file = {
              id,
              project_id: input.project_id,
              file_name: input.file_name,
              file_kind: "extension",
              storage_path: storagePath,
              mime_type: input.mime_type ?? null,
              size_bytes: input.data.byteLength,
              hash: "hash",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            };
            files.set(id, file);
            return file;
          },
          list: async () => [...files.values()],
          getOwnedFile: async (input: { file_id: string }) => files.get(input.file_id) ?? null,
          remove: async (input: { file_id: string }) => {
            removed.push(input);
            return files.delete(input.file_id);
          },
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    const projectFile = await env.storage.files.put({
      name: "notes.txt",
      data: Buffer.from("hello"),
      mimeType: "text/plain",
    });
    const ticketFile = await env.storage
      .collection("tickets")
      .attachments("ticket-1")
      .put({
        name: "screen.png",
        data: Buffer.from("image"),
        mimeType: "image/png",
      });

    expect(Buffer.from(await env.storage.files.getBytes(projectFile.id)).toString("utf8")).toBe("hello");
    await expect(env.storage.files.list()).resolves.toEqual([projectFile, ticketFile]);
    await env.storage.collection("tickets").attachments("ticket-1").delete(ticketFile.id);

    expect(projectFile).toMatchObject({ name: "notes.txt", mimeType: "text/plain", size: 5 });
    expect(ticketFile.url).toContain(`/v1/projects/project-1/extensions/instance-1/files/${ticketFile.id}/content`);
    expect(uploaded).toEqual([
      expect.objectContaining({ scope_type: "project", scope_id: "project-1", file_name: "notes.txt" }),
      expect.objectContaining({ scope_type: "collection:tickets", scope_id: "ticket-1", file_name: "screen.png" }),
    ]);
    expect(removed).toEqual([
      expect.objectContaining({ project_id: "project-1", extension_instance_id: "instance-1", file_id: ticketFile.id }),
    ]);
  });
});

describe("createCommandEnvironment settings", () => {
  test("settings use declared defaults and reject unknown keys", async () => {
    const env = createCommandEnvironment(
      {
        extensionSettingsService: makeSettingsService(),
        extensionStorageService: makeStorageService(),
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
        settings: labSettings as never,
      },
    );

    await expect(env.settings.get("counter.step")).resolves.toBe(1);
    await expect(env.settings.get("missing")).rejects.toMatchObject({ code: "extension_setting_unknown_key" });
    await expect(env.settings.set("counter.step", "large")).rejects.toMatchObject({
      code: "extension_setting_invalid",
    });
  });

  test("settings are independent from private extension storage", async () => {
    const storageService = (() => {
      const values = new Map<string, unknown>();
      return {
        ...makeStorageService(),
        getKv: async (_scope: unknown, key: string) => ({ value_json: values.get(key) }),
        setKv: async (input: { key: string; value_json: unknown }) => {
          values.set(input.key, input.value_json);
        },
      };
    })();
    const env = createCommandEnvironment(
      {
        extensionSettingsService: makeSettingsService(),
        extensionStorageService: storageService,
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
        settings: labSettings as never,
      },
    );

    await env.storage.set("counter.step", 99);

    await expect(env.settings.get("counter.step")).resolves.toBe(1);
  });
});

describe("createCommandEnvironment workspaces worktree mode", () => {
  test("provisions extension-created worktrees so harness hooks sync before sessions spawn", async () => {
    const provisioned: { projectId: string; workspace: { id: string }; repoPath: string }[] = [];

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),

        workspaceService: {
          setInitializing: async () => null,
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: "/repo",
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
          }),
          create: async (input: unknown) => ({
            id: "ws-1",
            workspace_shorthand: "T-1_A1",
            anchors_json: [],
            ...(input as object),
          }),
          updateProviderOperationProjection: async (id: string, input: { patch: unknown }) => ({
            id,
            workspace_shorthand: "T-1_A1",
            anchors_json: [],
            ...(input.patch as object),
          }),
        },
        eventBus: { emit: () => {} },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
      {
        runWorkspaceProvisioning: async (_deps, input) => {
          provisioned.push(input as never);
          return input.workspace;
        },
        setupWorkspaceWorktree: async () => ({
          branch: "workspace/T-1_A1",
          worktreePath: "/repo/.worktrees/T-1_A1",
          rootPath: "/repo/.worktrees/T-1_A1",
          sourceRoot: "/repo",
          relativePath: "",
        }),
      },
    );

    await env.workspaces.create({
      provider_id: "pstdio.worktree",
      shorthand_base: "T-1",
      anchors: [{ type: "ticket", id: "ticket-1", label: "T-1", metadata: { shorthand: "T-1" } }],
    });

    expect(provisioned).toHaveLength(1);
    expect(provisioned[0]!.projectId).toBe("project-1");
    expect(provisioned[0]!.repoPath).toBe("/repo");
    expect(provisioned[0]!.workspace).toMatchObject({
      id: "ws-1",
      branch: "workspace/T-1_A1",
      root_path: "/repo/.worktrees/T-1_A1",
    });
  });
});
