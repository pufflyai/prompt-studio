import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { readAttemptPage } from "../data/attempt-page";
import { readAttemptHistoryCommand, selectAttemptCommand } from "./attempt-history";
import { createSessionResource, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { runAttemptCommand } from "./run-attempt";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixture = async (missingGit = false) => {
  const root = await mkdtemp(join(tmpdir(), "planner-folder-"));
  roots.push(root);
  const storage = createMemoryStorage();
  const sessions = new Map<string, ReturnType<typeof createSessionResource>>();
  const inputs: unknown[] = [];
  const followups: unknown[] = [];
  const home = {
    id: "home",
    project_id: "proj-1",
    workspace_shorthand: "WS-1",
    provider_id: "pstdio.root",
    root_path: root,
    execution_kind: "local" as const,
    provider_state: "ready" as const,
  };
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      process: {
        run: async ({ command }) => {
          if (missingGit) throw new Error("Executable not found: git");
          const child = Bun.spawn(command, { cwd: root, stdout: "pipe", stderr: "pipe" });
          return {
            exitCode: await child.exited,
            stdout: await new Response(child.stdout).text(),
            stderr: await new Response(child.stderr).text(),
          };
        },
      },
      workspaces: {
        getDefault: async () => home,
        get: async (id) => (id === home.id ? home : null),
        create: async () => {
          throw new Error("Folder attempts must reuse the project workspace");
        },
      },
      sessions: {
        create: async (input) => {
          inputs.push(input);
          const session = {
            ...createSessionResource(),
            id: `session-${inputs.length}`,
            workspace_id: home.id,
            anchors_json: input.anchors ?? [],
          };
          sessions.set(session.id, session);
          return session;
        },
        get: async (id) => sessions.get(id) ?? null,
        query: async (query = {}) => ({
          items: [...sessions.values()].filter(
            (s) =>
              (!query.workspaceId || query.workspaceId === home.id) &&
              (!query.status || query.status.includes(s.status!)),
          ),
          nextCursor: null,
        }),
        followup: async (input) => {
          followups.push(input);
        },
      },
    },
  });
  const ticket = await createTicketCommand.run(ctx, { title: "Write a document" });
  return { ctx, ticket, root, home, sessions, inputs, followups };
};

test.each([
  false,
  true,
])("starts and resumes in the existing project workspace (Git missing: %s)", async (missingGit) => {
  const f = await fixture(missingGit);
  const first = await runAttemptCommand.run(f.ctx, { ticket: f.ticket.shorthand });
  expect(first.workspace.id).toBe(f.home.id);
  expect(first.variant.id).toBeString();
  expect(first.variant.id).not.toBe(f.home.id);
  expect(first.variant.workspaceId).toBe(f.home.id);
  expect(first.variant.base).toBeNull();
  expect(f.inputs).toEqual([
    expect.objectContaining({
      workspaceId: f.home.id,
      anchors: expect.arrayContaining([
        expect.objectContaining({ type: "ticket", id: f.ticket.id }),
        expect.objectContaining({ type: "planner-attempt", id: first.variant.id }),
      ]),
    }),
  ]);
  const resumed = await runAttemptCommand.run(f.ctx, { ticket: f.ticket.shorthand });
  expect(resumed.variant.id).toBe(first.variant.id);
  expect(f.inputs).toHaveLength(1);
  expect(f.followups).toHaveLength(1);
});

test("separate tickets and variants share a folder without overwriting attempts or their history", async () => {
  const f = await fixture();
  const first = await runAttemptCommand.run(f.ctx, { ticket: f.ticket.shorthand });
  for (const s of f.sessions.values()) s.status = "completed";
  const secondTicket = await createTicketCommand.run(f.ctx, { title: "Write another document" });
  const second = await runAttemptCommand.run(f.ctx, { ticket: secondTicket.shorthand });
  for (const s of f.sessions.values()) s.status = "completed";
  const variant = await runAttemptCommand.run(f.ctx, { ticket: f.ticket.shorthand, newVariant: true });
  expect(new Set([first.variant.id, second.variant.id, variant.variant.id]).size).toBe(3);
  expect((await readAttemptPage(f.ctx.storage)).variants).toHaveLength(3);
  for (const result of [first, second, variant]) {
    const history = await readAttemptHistoryCommand.run(f.ctx, { attemptId: result.variant.id });
    expect(history.variant.id).toBe(result.variant.id);
    expect(history.events).toEqual([
      expect.objectContaining({ type: "attempt_started", attemptId: result.variant.id, workspaceId: f.home.id }),
    ]);
  }
  await selectAttemptCommand.run(f.ctx, { ticket: f.ticket.shorthand, attemptId: first.variant.id });
  for (const s of f.sessions.values()) s.status = "completed";
  const resumed = await runAttemptCommand.run(f.ctx, { ticket: f.ticket.shorthand });
  expect(resumed.variant.id).toBe(first.variant.id);
});

test("another live session blocks a folder attempt without allocating a workspace or session", async () => {
  const f = await fixture();
  f.sessions.set("other", { ...createSessionResource(), id: "other", workspace_id: f.home.id });
  await expect(runAttemptCommand.run(f.ctx, { ticket: f.ticket.shorthand })).rejects.toThrow(/Another session/);
  expect(f.inputs).toHaveLength(0);
  expect((await readAttemptPage(f.ctx.storage)).variants).toHaveLength(0);
});

test("a repository without an initial commit uses its existing project folder", async () => {
  const f = await fixture();
  expect(await Bun.spawn(["git", "init", "-q", f.root]).exited).toBe(0);
  const result = await runAttemptCommand.run(f.ctx, { ticket: f.ticket.shorthand });
  expect(result.variant.base).toBeNull();
  expect(result.variant.workspaceId).toBe(f.home.id);
});
