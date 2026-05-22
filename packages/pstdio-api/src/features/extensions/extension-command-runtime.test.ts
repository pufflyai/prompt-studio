import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommandEnvironment } from "./extension-command-runtime";

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
