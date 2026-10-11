import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { listAttempts } from "../data/attempt-storage";
import { putTicket } from "../data/collections";
import { registerGate } from "../timeline/commands/gate-store";
import { savePlan } from "../timeline/commands/plan-store";
import { assignTrackCommand, createTrackCommand } from "../timeline/commands/track-commands";
import { autoBuildCommand } from "./auto-build";
import { createSessionResource, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { requestHumanCommand } from "./review-requests";
import { runAttemptCommand } from "./run-attempt";

function fixture(limit = 2) {
  const storage = createMemoryStorage();
  let sequence = 0;
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      settings: {
        get: async () => "",
        all: async () => ({ "automation.maxInProgress": limit }),
      },
      workspaces: {
        list: async () => [],
        create: async () => {
          sequence += 1;
          return { id: `workspace-${sequence}`, workspace_shorthand: `WS-${sequence}` };
        },
      } as never,
      sessions: {
        list: async () => [],
        create: async () => ({ ...createSessionResource(), id: `session-${sequence}` }),
        get: async () => createSessionResource(),
      } as never,
    },
  });
  const ticket = (title: string, dependsOn: string[] = []) =>
    createTicketCommand.run(ctx, { title, statusId: "ready", dependsOn });
  return { ctx, storage, ticket };
}

test("fills slots in timeline order with independent tickets on the same track", async () => {
  const { ctx, storage, ticket } = fixture();
  const first = await ticket("First");
  const second = await ticket("Second");
  const third = await ticket("Third");
  const track = await createTrackCommand.run(ctx, { name: "Product" });
  for (const row of [first, second, third]) await assignTrackCommand.run(ctx, { ticket: row.id, track: track.id });
  await savePlan(
    ctx,
    {
      deadlines: [],
      order: [second, first, third].map((row) => ({ ticketId: row.id, deadlineId: null })),
    },
    "test",
  );

  const result = await autoBuildCommand.run(ctx, {});

  expect(result.started.map((row) => row.ticket)).toEqual([second.shorthand, first.shorthand]);
  expect(await listAttempts(storage)).toHaveLength(2);
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([]);
});

test("skips unresolved cross-track dependencies and fills remaining slots", async () => {
  const { ctx, ticket } = fixture();
  const first = await ticket("Prerequisite");
  const dependent = await ticket("Dependent", [first.shorthand]);
  const independent = await ticket("Independent");
  const track = await createTrackCommand.run(ctx, { name: "Other" });
  await assignTrackCommand.run(ctx, { ticket: dependent.id, track: track.id });
  const result = await autoBuildCommand.run(ctx, {});
  expect(result.started.map((row) => row.ticket)).toEqual([first.shorthand, independent.shorthand]);
  expect(result.skipped).toContainEqual({ ticket: dependent.shorthand, reason: "dependency-not-ready" });
});

test("leaves backlog, blocked tickets, gates, and human requests for review", async () => {
  const { ctx, storage, ticket } = fixture(10);
  await createTicketCommand.run(ctx, { title: "Backlog" });
  const blocked = await ticket("Blocked");
  await putTicket(storage, { ...blocked, blockedReason: "Needs credentials" });
  const gate = await ticket("Gate");
  await registerGate(ctx, gate.id);
  const human = await ticket("Question");
  await requestHumanCommand.run(ctx, {
    ticket: human.id,
    title: "Choose",
    instructions: "Confirm the scope",
    request: { kind: "task" },
  });
  const ready = await ticket("Ready");
  expect((await autoBuildCommand.run(ctx, {})).started.map((row) => row.ticket)).toEqual([ready.shorthand]);
});

test("starts nothing when the configured limit is zero", async () => {
  const { ctx, storage, ticket } = fixture(0);
  await ticket("Ready");
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([]);
  expect(await listAttempts(storage)).toEqual([]);
});

test("concurrent starts for different tickets never exceed project capacity", async () => {
  const { ctx, storage, ticket } = fixture(1);
  const first = await ticket("First");
  const second = await ticket("Second");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const create = ctx.workspaces.create;
  ctx.workspaces.create = async (input) => {
    await gate;
    return create(input);
  };
  const pending = Promise.allSettled([
    runAttemptCommand.run(ctx, { ticket: first.id }),
    runAttemptCommand.run(ctx, { ticket: second.id }),
  ]);
  await Promise.resolve();
  release();
  const outcomes = await pending;
  expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
  expect(await listAttempts(storage)).toHaveLength(1);
});

test("preserves successful launches and reports a later launch failure", async () => {
  const { ctx, storage, ticket } = fixture();
  const first = await ticket("First");
  const second = await ticket("Second");
  let calls = 0;
  ctx.sessions.create = async () => {
    calls += 1;
    if (calls === 2) throw new Error("Agent unavailable");
    return createSessionResource();
  };
  const result = await autoBuildCommand.run(ctx, {});
  expect(result.started.map((row) => row.ticket)).toEqual([first.shorthand]);
  expect(result.errors).toEqual([{ ticket: second.shorthand, message: "Agent unavailable" }]);
  expect(await listAttempts(storage)).toHaveLength(1);
});

test("rechecks a later ticket when its status changes during the batch", async () => {
  const { ctx, storage, ticket } = fixture();
  const first = await ticket("First");
  const second = await ticket("Second");
  ctx.sessions.create = async () => {
    await putTicket(storage, { ...second, statusId: "done" });
    return createSessionResource();
  };
  expect((await autoBuildCommand.run(ctx, {})).started.map((row) => row.ticket)).toEqual([first.shorthand]);
});

test("uses the repository default branch when the project is on unrelated feature work", async () => {
  const { ctx, ticket } = fixture();
  const folder = await mkdtemp(join(tmpdir(), "auto-build-base-"));
  const git = async (...args: string[]) => {
    const result = await Bun.$`git -C ${folder} ${args}`.quiet();
    return result.text().trim();
  };
  try {
    await git("init", "-b", "trunk");
    await git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-m", "Initial");
    const base = await git("rev-parse", "HEAD");
    await git("update-ref", "refs/remotes/origin/trunk", "HEAD");
    await git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk");
    await git("checkout", "-b", "feature/unrelated");
    await git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--allow-empty",
      "-m",
      "Unrelated",
    );
    ctx.workspaces.getDefault = async () => ({ id: "home", root_path: folder, execution_kind: "local" }) as never;
    ctx.process.run = async ({ command, cwd }) => {
      const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" });
      return {
        exitCode: await child.exited,
        stdout: await new Response(child.stdout).text(),
        stderr: await new Response(child.stderr).text(),
      };
    };
    const bases: unknown[] = [];
    const create = ctx.workspaces.create;
    ctx.workspaces.create = async (input) => {
      bases.push(input.params?.base);
      return create(input);
    };
    await ticket("Ready");
    expect((await autoBuildCommand.run(ctx, {})).errors).toEqual([]);
    expect(bases).toEqual([base]);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
