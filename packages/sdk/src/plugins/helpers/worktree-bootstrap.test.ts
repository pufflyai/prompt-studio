import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootstrapWorktree } from "./worktree-bootstrap";

const createTempDir = () => {
  const base = join("/tmp", "pstdio-test", crypto.randomUUID());
  mkdirSync(base, { recursive: true });
  return base;
};

const rmrf = (dir: string) => {
  if (existsSync(dir)) {
    const { rmSync } = require("node:fs");
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("bootstrapWorktree", () => {
  const dirs: string[] = [];
  const helperCtx = {
    projectId: "proj-1",
    client: {
      tickets: {
        list: async () => [],
        get: async () => {
          throw new Error("not used");
        },
        listFiles: async () => [],
      },
    },
  } as never;

  const makeDirs = () => {
    const base = createTempDir();
    dirs.push(base);
    const repoPath = join(base, "repo");
    const worktreePath = join(base, "worktree");
    mkdirSync(repoPath, { recursive: true });
    mkdirSync(worktreePath, { recursive: true });
    return { repoPath, worktreePath };
  };

  afterEach(() => {
    for (const dir of dirs) rmrf(dir);
    dirs.length = 0;
  });

  it("copies .pstdio/config.json to the worktree", async () => {
    const { repoPath, worktreePath } = makeDirs();
    const configDir = join(repoPath, ".pstdio");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), '{"key":"value"}');

    await bootstrapWorktree(helperCtx, { repoPath, worktreePath });

    const copied = readFileSync(join(worktreePath, ".pstdio", "config.json"), "utf-8");
    expect(copied).toBe('{"key":"value"}');
  });

  it("skips config copy when .pstdio/config.json does not exist", async () => {
    const { repoPath, worktreePath } = makeDirs();

    await bootstrapWorktree(helperCtx, { repoPath, worktreePath });

    expect(existsSync(join(worktreePath, ".pstdio", "config.json"))).toBe(false);
  });

  it("copies agent directories that exist", async () => {
    const { repoPath, worktreePath } = makeDirs();

    const claudeDir = join(repoPath, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, "settings.json"), "{}");

    const agentsDir = join(repoPath, ".agents");
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, "agent.yaml"), "name: test");

    await bootstrapWorktree(helperCtx, { repoPath, worktreePath });

    expect(readFileSync(join(worktreePath, ".claude", "settings.json"), "utf-8")).toBe("{}");
    expect(readFileSync(join(worktreePath, ".agents", "agent.yaml"), "utf-8")).toBe("name: test");
    expect(existsSync(join(worktreePath, ".opencode"))).toBe(false);
  });

  it("pulls the ticket into the worktree using sdk client when ticketId is provided", async () => {
    const { repoPath, worktreePath } = makeDirs();
    const ticketGetCalls: string[] = [];
    const ticketListCalls: string[] = [];
    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async (_projectId: string, filters?: { shorthand?: string }) => {
            ticketListCalls.push(filters?.shorthand ?? "");
            return [{ id: "ticket-1", shorthand: "PS-12", status_name: "open", tag_names: [] }];
          },
          get: async (ticketId: string) => {
            ticketGetCalls.push(ticketId);
            return {
              id: "ticket-1",
              shorthand: "PS-12",
              content: "Pulled ticket content",
              created_at: "2026-01-01T00:00:00Z",
              draft: false,
              parent_id: null,
              user_prompt: null,
              depends_on: null,
              parallelizable: null,
              blocked_reason: null,
              file_id: null,
            };
          },
          listFiles: async () => [],
        },
      },
    } as never;

    await bootstrapWorktree(ctx, { repoPath, worktreePath, ticketId: "ticket-1" });

    expect(ticketGetCalls).toEqual(["ticket-1", "ticket-1"]);
    expect(ticketListCalls).toEqual(["PS-12"]);
    expect(readFileSync(join(worktreePath, ".pstdio", "tickets", "PS-12", "ticket.md"), "utf-8")).toContain(
      'ticket_id: "PS-12"',
    );
  });
});
