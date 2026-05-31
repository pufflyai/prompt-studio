import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  test("creates ticket-backed workspaces from extension context helpers", async () => {
    const created: unknown[] = [];
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: {
          create: async (input: unknown) => {
            created.push(input);
            return { id: "ws-1", ...(input as object) };
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

    const workspace = await env.workspaces.create({
      ticket_id: "ticket-1",
      ticket_shorthand: "PS-1",
      branch: "feature/ps-1",
    });

    expect(workspace).toMatchObject({ id: "ws-1" });
    expect(created).toEqual([
      {
        project_id: "project-1",
        ticket_id: "ticket-1",
        ticket_shorthand: "PS-1",
        branch: "feature/ps-1",
        worktree_path: undefined,
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

  test("exposes ticket status definitions to extension context helpers", async () => {
    const emitted: unknown[] = [];
    const updated: unknown[] = [];
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        eventBus: {
          emit: (collection: string, action: string, row: unknown) => {
            emitted.push({ collection, action, row });
          },
        },
        statusService: {
          list: async () => [
            {
              id: "status-done",
              project_id: "project-1",
              name: "done",
              color: "green",
              sort_order: 6,
              is_default: false,
              can_create: false,
              can_drag_in: true,
              can_drag_out: true,
              column_actions: JSON.stringify(["archive_all"]),
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
              deleted_at: null,
            },
          ],
          update: async (_statusId: string, input: unknown) => {
            updated.push(input);
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

    await expect(env.ticketStatuses?.list()).resolves.toEqual([
      expect.objectContaining({
        id: "status-done",
        name: "done",
        sortOrder: 6,
        columnActions: ["archive_all"],
      }),
    ]);

    await env.ticketStatuses?.update({ statusId: "status-done", columnActions: [] });

    expect(updated).toEqual([{ column_actions: [] }]);
    expect(emitted).toEqual([
      {
        collection: "ticket_statuses",
        action: "set",
        row: expect.objectContaining({ id: "status-done" }),
      },
    ]);
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

describe("createCommandEnvironment tickets", () => {
  test("lists project tickets from extension context helpers", async () => {
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        statusService: {
          getByName: async (_projectId: string, name: string) =>
            name === "ready" ? { id: "status-ready", name: "ready" } : null,
          list: async () => [
            { id: "status-ready", name: "ready" },
            { id: "status-done", name: "done" },
          ],
        },
        ticketService: {
          list: async (projectId: string, filters: unknown) => {
            expect(projectId).toBe("project-1");
            expect(filters).toEqual({ archived: false, status_id: "status-ready" });
            return [
              {
                id: "ticket-1",
                shorthand: "PS-304",
                project_id: projectId,
                status_id: "status-ready",
                display_title: "Move tickets",
                user_prompt: null,
                file_id: null,
                parent_id: null,
                parallelizable: null,
                blocked_reason: null,
                depends_on: null,
                draft: false,
                archived: false,
                deleted_at: null,
                created_at: "2026-05-27T09:00:00.000Z",
                updated_at: "2026-05-27T10:00:00.000Z",
              },
            ];
          },
          getTagOptionAssignments: async () => [{ id: "tag-1", name: "ui" }],
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        projectId: "project-1",
      },
    );

    await expect(env.tickets?.list({ archived: false, status: "ready" })).resolves.toEqual([
      expect.objectContaining({
        id: "ticket-1",
        shorthand: "PS-304",
        status_name: "ready",
        tag_ids: ["tag-1"],
        tag_names: ["ui"],
      }),
    ]);
  });

  test("lists ticket files from extension context helpers", async () => {
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        ticketService: {
          get: async () => null,
          getByShorthand: async (_projectId: string, ref: string) =>
            ref === "PS-304" ? { id: "ticket-1", shorthand: "PS-304" } : null,
        },
        fileService: {
          listForTicket: async (ticketId: string) => {
            expect(ticketId).toBe("ticket-1");
            return [
              {
                id: "file-ticket",
                file_name: "ticket.md",
                file_kind: "ticket_file",
                mime_type: "text/markdown",
              },
            ];
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

    await expect(env.tickets?.listFiles("PS-304")).resolves.toEqual([
      expect.objectContaining({
        id: "file-ticket",
        file_name: "ticket.md",
        fileName: "ticket.md",
        file_kind: "ticket_file",
        fileKind: "ticket_file",
        mime_type: "text/markdown",
        mimeType: "text/markdown",
      }),
    ]);
  });

  test("updates ticket content from extension context helpers", async () => {
    const fileUpdates: unknown[] = [];
    const ticketUpdates: unknown[] = [];
    const events: unknown[] = [];
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        eventBus: {
          emit: (table: string, action: string, payload: unknown) => {
            events.push({ table, action, payload });
          },
        },
        ticketService: {
          get: async () => ({
            id: "ticket-1",
            shorthand: "PS-304",
            project_id: "project-1",
            file_id: "file-ticket",
          }),
          update: async (ticketId: string, input: unknown) => {
            ticketUpdates.push({ ticketId, input });
            return { id: ticketId, shorthand: "PS-304", ...(input as object) };
          },
        },
        fileService: {
          update: async (fileId: string, input: { data: Buffer }) => {
            fileUpdates.push({ fileId, content: input.data.toString("utf8") });
            return { id: fileId, file_name: "ticket.md" };
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

    await expect(env.tickets?.update({ ticket: "ticket-1", content: "# Updated ticket" })).resolves.toMatchObject({
      id: "ticket-1",
      display_title: "Updated ticket",
      file_id: "file-ticket",
    });
    expect(fileUpdates).toEqual([{ fileId: "file-ticket", content: "# Updated ticket" }]);
    expect(ticketUpdates).toEqual([
      {
        ticketId: "ticket-1",
        input: { display_title: "Updated ticket", file_id: "file-ticket" },
      },
    ]);
    expect(events).toEqual([{ table: "files", action: "set", payload: { id: "file-ticket", file_name: "ticket.md" } }]);
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
    const supportFilePath = join(root, "support.md");
    writeFileSync(supportFilePath, "supporting context");

    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        ticketService: {
          get: async (ticketId: string) => {
            if (ticketId !== "ticket-1") throw { status: 404 };
            return {
              id: "ticket-1",
              shorthand: "PS-1",
              created_at: "2026-01-01T00:00:00.000Z",
              draft: false,
              parent_id: null,
              user_prompt: null,
              depends_on: null,
              parallelizable: null,
              blocked_reason: null,
              file_id: "file-ticket",
              status_id: "status-ready",
              content: "# Ticket title\n\nTicket body",
            };
          },
          list: async () => [
            {
              id: "ticket-1",
              shorthand: "PS-1",
              status_id: "status-ready",
              created_at: "2026-01-01T00:00:00.000Z",
              draft: false,
              archived: false,
            },
          ],
          getTagOptionAssignments: async () => [{ id: "tag-1", name: "frontend" }],
        },
        fileService: {
          get: async (fileId: string) => {
            if (fileId === "file-support") return { id: "file-support", storage_path: supportFilePath };
            return null;
          },
          listForTicket: async () => [
            { id: "file-ticket", file_name: "ticket.md", storage_path: join(root, "ticket.md") },
            { id: "file-support", file_name: "support.md", storage_path: supportFilePath },
          ],
        },
        statusService: {
          list: async () => [{ id: "status-ready", name: "ready" }],
        },
        workspaceService: {},
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        projectId: "project-1",
      },
    );

    await env.worktrees.bootstrap({ repoPath, worktreePath, ticketId: "ticket-1" });

    expect(readFileSync(join(worktreePath, ".pstdio", "config.json"), "utf8")).toBe('{"project":"demo"}');
    expect(readFileSync(join(worktreePath, ".agents", "agent.yaml"), "utf8")).toBe("name: test");
    const ticketPath = join(worktreePath, ".pstdio", "tickets", "PS-1", "ticket.md");
    expect(existsSync(ticketPath)).toBe(true);
    expect(readFileSync(ticketPath, "utf8")).toBe(
      [
        "---",
        'ticket_id: "PS-1"',
        'created: "2026-01-01T00:00:00.000Z"',
        "draft: false",
        'status: "ready"',
        'tags: ["frontend"]',
        "---",
        "",
        "# Ticket title",
        "",
        "Ticket body",
      ].join("\n"),
    );
    expect(readFileSync(join(worktreePath, ".pstdio", "tickets", "PS-1", "files", "support.md"), "utf8")).toBe(
      "supporting context",
    );
  });
});
