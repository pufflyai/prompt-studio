import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommandEnvironment, loadProjectExtensionRuntime } from "./extension-command-runtime";

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

const writeRuntimeExtension = (root: string, commandName: string) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "hello",
      version: "1.0.0",
      displayName: "Hello",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
  commands: {
    ${JSON.stringify(commandName)}: { title: ${JSON.stringify(commandName)}, run: async () => undefined },
  },
};`,
  );
};

describe("createCommandEnvironment host primitives", () => {
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

  test("exposes repoFiles scoped to the registered repo root, ignoring a forged client path", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-repo-files-test-"));
    tempRoots.push(root);

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        // Only repo-1 is registered, pointing at the real root.
        repoService: { listByProject: async () => [{ id: "repo-1", path: root }] },
        workspaceService: { list: async () => [] },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
        // A forged request supplies an arbitrary path; it must be ignored.
        repo: { projectId: "project-1", repoId: "repo-1", path: "/tmp/attacker-controlled" },
      },
    );

    if (!env.repoFiles) throw new Error("expected repoFiles to be present");
    await env.repoFiles.writeText(".pstdio/tickets/PS-1/ticket.md", "# hi");

    expect(readFileSync(join(root, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8")).toBe("# hi");
    expect(await env.repoFiles.readText(".pstdio/tickets/PS-1/ticket.md")).toBe("# hi");
    await expect(env.repoFiles.writeText("../escape.md", "x")).rejects.toThrow(/escapes/);
  });

  test("mounts repoFiles at a worktree path that matches a known workspace", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-repo-root-"));
    const worktreeRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-worktree-"));
    tempRoots.push(repoRoot, worktreeRoot);

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        repoService: { listByProject: async () => [{ id: "repo-1", path: repoRoot }] },
        workspaceService: { list: async () => [{ id: "ws-1", worktree_path: worktreeRoot }] },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
        // The CLI resolves a worktree to its owning registered repo but keeps the
        // worktree's own path so edits land in the workspace, not the main checkout.
        repo: { projectId: "project-1", repoId: "repo-1", path: worktreeRoot },
      },
    );

    if (!env.repoFiles) throw new Error("expected repoFiles to be present");
    await env.repoFiles.writeText(".pstdio/tickets/PS-1/ticket.md", "# wt");

    expect(readFileSync(join(worktreeRoot, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8")).toBe("# wt");
    expect(readFileSync.bind(null, join(repoRoot, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8")).toThrow();
  });

  test("repoFiles rejects a repo that is not registered for the project", async () => {
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        repoService: { listByProject: async () => [{ id: "repo-1", path: "/repo" }] },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
        repo: { projectId: "project-1", repoId: "unregistered", path: "/anywhere" },
      },
    );

    if (!env.repoFiles) throw new Error("expected repoFiles to be present");
    await expect(env.repoFiles.writeText("file.md", "x")).rejects.toThrow(/not registered/);
  });

  test("omits repoFiles when the invocation has no repo", () => {
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

    expect(env.repoFiles).toBeUndefined();
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

    expect(() => env.storage.scope({ type: "repo" } as never)).toThrow("repo storage scope requires repoId");
    expect(() => env.storage.scope({ type: "resource" } as never)).toThrow(
      "resource storage scope requires resource.id",
    );
    expect(() => env.storage.scope({ type: "custom" } as never)).toThrow("custom storage scope requires id");
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
      { extensionStorageService: makeStorageService() } as never,
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
        repoService: {
          listByProject: async () => [{ id: "repo-1", path: repoPath }],
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
            fullPath: ".pstdio/extension-lab/reports",
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

    expect(readFileSync(join(repoPath, ".pstdio", "extension-lab", "reports", "latest.md"), "utf8")).toBe("hello");
    expect(() => env.artifacts.mount("missing")).toThrow("Artifact mount not found: missing");
  });
});

describe("createCommandEnvironment workspaces", () => {
  test("creates anchored workspaces from extension context helpers", async () => {
    const created: unknown[] = [];
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        repoService: {
          listByProject: async () => [{ id: "repo-1", path: "/repo" }],
        },
        workspaceService: {
          create: async (input: unknown) => {
            created.push(input);
            return { id: "ws-1", workspace_shorthand: "T-1_A1", anchors_json: [], ...(input as object) };
          },
          updateGitMetadata: async (id: string, input: unknown) => ({
            id,
            workspace_shorthand: "T-1_A1",
            ...(input as object),
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
        setupWorkspaceWorktree: async () => ({ branch: "workspace/T-1_A1", worktreePath: "/repo/.worktrees/T-1_A1" }),
      },
    );

    const workspace = await env.workspaces.create({
      shorthand_base: "T-1",
      mode: "current_branch",
      anchors: [{ type: "ticket", id: "ticket-1", label: "T-1", metadata: { shorthand: "T-1" } }],
    });

    expect(workspace).toMatchObject({ id: "ws-1" });
    expect(created).toEqual([
      {
        project_id: "project-1",
        shorthand_base: "T-1",
        anchors: [{ type: "ticket", id: "ticket-1", label: "T-1", metadata: { shorthand: "T-1" } }],
      },
    ]);
  });

  test("resolves workspaces by shorthand from extension context helpers", async () => {
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: {
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

  test("archive cascades to the workspace's active sessions", async () => {
    const archivedWorkspaces: string[] = [];
    const archivedSessions: string[] = [];
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        repoService: { listByProject: async () => [{ id: "repo-1", path: "/repo" }] },
        workspaceService: {
          get: async (id: string) => ({
            id,
            project_id: "project-1",
            workspace_shorthand: "T-1_A1",
            branch: null,
            worktree_path: null,
            archived: false,
          }),
          archive: async (id: string) => {
            archivedWorkspaces.push(id);
            return { id, archived: true };
          },
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

  test("does not expose legacy ticket helpers", async () => {
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    expect("tickets" in env).toBe(false);
    expect("ticketStatuses" in env).toBe(false);
    expect("attemptStatuses" in env).toBe(false);
    expect("setAttemptStatus" in env.workspaces).toBe(false);
  });

  test("queues session follow-ups from extension context helpers", async () => {
    const inserted: unknown[] = [];
    const session = {
      id: "session-1",
      project_id: "project-1",
      status: "in_progress",
      agent: "fake",
      agent_session_id: "agent-session-1",
      cwd: "/repo",
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

describe("createCommandEnvironment sessions", () => {
  test("uses the linked repo path for extension-created project sessions", async () => {
    const createdSessions: unknown[] = [];
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        repoService: {
          listByProject: async () => [{ id: "repo-1", path: "/repo" }],
        },
        workspaceService: {
          get: async () => null,
          getByShorthand: async () => null,
        },
        projectService: {
          get: async () => ({ id: "project-1", default_agent_id: null, default_agent_model: null }),
        },
        harnessRegistry: {
          get: async () => ({
            start: async () => ({
              agentSessionId: "agent-session-1",
              done: new Promise(() => {}),
              stop: () => {},
            }),
          }),
          list: async () => [{ id: "fake-agent" }],
        },
        settingsService: {
          get: async () => ({ max_concurrent_sessions: null }),
        },
        sessionService: {
          create: async (input: Record<string, unknown>) => {
            createdSessions.push(input);
            return {
              id: "session-1",
              project_id: input.project_id,
              title: input.title,
              status: "in_progress",
              agent: input.agent,
              last_selected_model: input.last_selected_model ?? null,
              cwd: input.cwd ?? null,
            };
          },
          update: async () => null,
          get: async () => null,
          transitionStatus: async () => null,
          store: {
            create: mock(() => ({
              eventStore: {
                push: () => {},
                getHistory: () => [],
                subscribe: async function* () {},
              },
              approvalService: { handleResponse: () => {}, dispose: () => {} },
            })),
            get: mock(() => null),
            setSession: mock(() => {}),
            remove: mock(() => {}),
          },
        },
        eventBus: { emit: () => {} },
        activityEventsService: { create: async () => ({}) },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    await env.sessions.create({ title: "Refine ticket: T-1", prompt: "Refine ticket T-1" });

    expect(createdSessions[0]).toMatchObject({ cwd: "/repo" });
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

describe("loadProjectExtensionRuntime", () => {
  test("passes installed source kind and repo roots into normalization", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-runtime-"));
    tempRoots.push(root);
    const globalPath = join(root, "global-hello");
    const repoPath = join(root, "repo");
    const localPath = join(repoPath, ".pstdio", "extensions", "hello");
    writeRuntimeExtension(globalPath, "global");
    writeRuntimeExtension(localPath, "local");

    const { project, runtime } = await loadProjectExtensionRuntime(
      {
        extensionService: {
          listEnabledSourcesForProject: async () => [
            {
              instance: { id: "global-instance", namespace: "hello", enabled: true },
              installedSource: {
                id: "global-source",
                extension_id: "pstdio.hello",
                source_kind: "git",
                source_path: globalPath,
              },
            },
            {
              instance: { id: "local-instance", namespace: "hello", enabled: true },
              installedSource: {
                id: "local-source",
                extension_id: "pstdio.hello",
                source_kind: "local_path",
                source_path: localPath,
              },
            },
          ],
        },
        repoService: {
          listByProject: async () => [{ id: "repo-1", path: repoPath }],
        },
        projectService: { get: async () => projectContext },
      } as never,
      "project-1",
    );

    expect(project).toEqual(projectContext);
    expect(runtime.commands.map((command) => command.id)).toEqual(["hello.local"]);
    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_overridden_by_local");
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
        repoService: { listByProject: async () => [{ id: "repo-1", path: "/repo" }] },
        workspaceService: {
          create: async (input: unknown) => ({
            id: "ws-1",
            workspace_shorthand: "T-1_A1",
            anchors_json: [],
            ...(input as object),
          }),
          updateGitMetadata: async (id: string, input: unknown) => ({
            id,
            workspace_shorthand: "T-1_A1",
            ...(input as object),
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
        }),
      },
    );

    await env.workspaces.create({
      shorthand_base: "T-1",
      mode: "worktree",
      anchors: [{ type: "ticket", id: "ticket-1", label: "T-1", metadata: { shorthand: "T-1" } }],
    });

    expect(provisioned).toHaveLength(1);
    expect(provisioned[0]!.projectId).toBe("project-1");
    expect(provisioned[0]!.repoPath).toBe("/repo");
    expect(provisioned[0]!.workspace).toMatchObject({
      id: "ws-1",
      branch: "workspace/T-1_A1",
      worktree_path: "/repo/.worktrees/T-1_A1",
    });
  });
});
