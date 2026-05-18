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
              content: "# Ticket title\n\nTicket body",
            };
          },
          list: async () => [
            {
              id: "ticket-1",
              shorthand: "PS-1",
              status_id: null,
              created_at: "2026-01-01T00:00:00.000Z",
              draft: false,
              archived: false,
            },
          ],
          getTagOptionAssignments: async () => [],
        },
        fileService: {
          listForTicket: async () => [{ id: "file-ticket", file_name: "ticket.md" }],
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
    expect(existsSync(join(worktreePath, ".pstdio", "tickets", "PS-1", "ticket.md"))).toBe(true);
    expect(readFileSync(join(worktreePath, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8")).toContain(
      "Ticket body",
    );
  });
});
