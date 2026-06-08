import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { worktreeEvents } from "@pstdio/sdk/extensions";
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

const makeStorageService = () => ({
  getKv: async () => null,
  setKv: async () => {},
  deleteKv: async () => {},
  getCollectionItem: async () => null,
  listCollection: async () => [],
  setCollectionItem: async () => {},
  deleteCollectionItem: async () => {},
});

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
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
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
        projectId: "project-1",
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
    const attached: unknown[] = [];
    const detached: unknown[] = [];
    const removed: string[] = [];
    const events: unknown[] = [];

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        extensionFilesService: {
          attach: async (input: unknown) => {
            attached.push(input);
          },
          list: async () => [...files.values()],
          getOwnedFile: async (input: { file_id: string }) => files.get(input.file_id) ?? null,
          detach: async (input: unknown) => {
            detached.push(input);
            return true;
          },
        },
        fileService: {
          upload: async (input: {
            data: Buffer;
            file_kind: string;
            file_name: string;
            mime_type?: string | null;
            project_id: string;
          }) => {
            const id = `file-${(files.size + 1).toString()}`;
            const storagePath = join(root, id);
            writeFileSync(storagePath, input.data);
            const file = {
              id,
              project_id: input.project_id,
              file_name: input.file_name,
              file_kind: input.file_kind,
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
          remove: async (fileId: string) => {
            removed.push(fileId);
            files.delete(fileId);
          },
        },
        eventBus: {
          emit: (table: string, action: string, payload: unknown) => {
            events.push({ table, action, payload });
          },
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
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
    expect(attached).toEqual([
      expect.objectContaining({ scope_type: "project", scope_id: "project-1", file_id: projectFile.id }),
      expect.objectContaining({ scope_type: "collection:tickets", scope_id: "ticket-1", file_id: ticketFile.id }),
    ]);
    expect(detached).toEqual([
      expect.objectContaining({ project_id: "project-1", extension_instance_id: "instance-1", file_id: ticketFile.id }),
    ]);
    expect(removed).toEqual([ticketFile.id]);
    expect(events).toEqual([
      { table: "files", action: "set", payload: expect.objectContaining({ id: projectFile.id }) },
      { table: "files", action: "set", payload: expect.objectContaining({ id: ticketFile.id }) },
      { table: "files", action: "delete", payload: { id: ticketFile.id } },
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

    const { runtime } = await loadProjectExtensionRuntime(
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
      } as never,
      "project-1",
    );

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
        projectId: "project-1",
        settings: labSettings as never,
      },
    );

    await env.storage.set("counter.step", 99);

    await expect(env.settings.get("counter.step")).resolves.toBe(1);
  });
});

describe("extension worktree environment", () => {
  test("bootstraps a worktree from extension context helpers", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-worktree-bootstrap-test-"));
    tempRoots.push(root);
    const repoPath = join(root, "repo");
    const worktreePath = join(root, "worktree");
    mkdirSync(join(repoPath, ".pstdio"), { recursive: true });
    mkdirSync(join(repoPath, ".agents"), { recursive: true });
    mkdirSync(worktreePath, { recursive: true });
    writeFileSync(join(repoPath, ".pstdio", "config.json"), '{"project":"demo"}');
    writeFileSync(join(repoPath, ".agents", "agent.yaml"), "name: test");

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: {},
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        projectId: "project-1",
      },
    );

    await env.worktrees.bootstrap({ repoPath, worktreePath });

    expect(readFileSync(join(worktreePath, ".pstdio", "config.json"), "utf8")).toBe('{"project":"demo"}');
    expect(readFileSync(join(worktreePath, ".agents", "agent.yaml"), "utf8")).toBe("name: test");
    expect(existsSync(join(worktreePath, ".pstdio", "tickets"))).toBe(false);
  });
});

describe("createCommandEnvironment workspaces worktree mode", () => {
  test("fires worktree.created so bootstrap hooks run for extension-created worktrees", async () => {
    const fired: { event: unknown; payload: unknown }[] = [];

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
        projectId: "project-1",
      },
      {
        fireExtensionEventAsync: (_deps, _projectId, event, payload) => {
          fired.push({ event, payload });
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

    expect(fired).toHaveLength(1);
    expect(fired[0]!.event).toEqual(worktreeEvents.created);
    expect(fired[0]!.payload).toMatchObject({
      projectId: "project-1",
      repoPath: "/repo",
      worktreePath: "/repo/.worktrees/T-1_A1",
      branch: "workspace/T-1_A1",
      workspace: "T-1_A1",
      workspaceId: "ws-1",
    });
  });
});
