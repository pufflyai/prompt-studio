import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listAttempts } from "../data/attempt-storage";
import { putTicket } from "../data/collections";
import { registerGate } from "../timeline/commands/gate-store";
import { savePlan } from "../timeline/commands/plan-store";
import { assignTrackCommand, createTrackCommand, readTrack } from "../timeline/commands/track-commands";
import { autoBuildCommand } from "./auto-build";
import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { createSessionResource } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { requestHumanCommand } from "./review-requests";
import { runAttemptCommand } from "./run-attempt";
import { deleteTicketTagCommand } from "./ticket-tags";

test("fills slots in timeline order with independent tickets", async () => {
  const { ctx, storage, ticket } = await fixture();
  const first = await ticket("First");
  const second = await ticket("Second");
  const third = await ticket("Third");
  const track = await createTrackCommand.run(ctx, { name: "Product" });
  for (const row of [first, second, third]) await assignTrackCommand.run(ctx, { ticket: row.id, track: track.id });
  await storage.set("auto-build", {
    revision: "test",
    enabled: true,
    filter: { conjunction: "and", rules: [] },
  });
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
  const { ctx, storage, ticket } = await fixture();
  const first = await ticket("Prerequisite");
  const dependent = await ticket("Selected dependent", [first.shorthand]);
  const independent = await ticket("Selected independent");
  const track = await createTrackCommand.run(ctx, { name: "Other" });
  await assignTrackCommand.run(ctx, { ticket: first.id, track: track.id });
  await storage.set("auto-build", {
    revision: "test",
    enabled: true,
    filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Selected" }] },
  });
  const result = await autoBuildCommand.run(ctx, {});
  expect(result.started.map((row) => row.ticket)).toEqual([independent.shorthand]);
  expect(result.skipped).toEqual([{ ticket: dependent.shorthand, reason: "dependency-not-ready" }]);
});

test("leaves backlog, blocked tickets, gates, and human requests for review", async () => {
  const { ctx, storage, ticket } = await fixture(10);
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
  const { ctx, storage, ticket } = await fixture(0);
  await ticket("Ready");
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([]);
  expect(await listAttempts(storage)).toEqual([]);
});

test("concurrent starts for different tickets never exceed project capacity", async () => {
  const { ctx, storage, ticket } = await fixture(1);
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
  const { ctx, storage, ticket } = await fixture();
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
  const { ctx, storage, ticket } = await fixture();
  const first = await ticket("First");
  const second = await ticket("Second");
  ctx.sessions.create = async () => {
    await putTicket(storage, { ...second, statusId: "done" });
    return createSessionResource();
  };
  expect((await autoBuildCommand.run(ctx, {})).started.map((row) => row.ticket)).toEqual([first.shorthand]);
});

test("uses the repository default branch when the project is on unrelated feature work", async () => {
  const { ctx, ticket } = await fixture();
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

test("starts matching tickets on later checks when they become available", async () => {
  const { ctx, storage, ticket } = await fixture();
  const other = await ticket("Other track");
  const track = await createTrackCommand.run(ctx, { name: "Product" });
  await storage.set("auto-build", {
    revision: "test",
    enabled: true,
    filter: {
      conjunction: "and",
      rules: [{ attributeId: (await readTrack(ctx))!.id, condition: "is-any-of", value: [track.id] }],
    },
  });
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([]);
  const ready = await ticket("New matching work");
  await assignTrackCommand.run(ctx, { ticket: ready.id, track: track.id });
  expect((await autoBuildCommand.run(ctx, {})).started.map(({ ticket }) => ticket)).toEqual([ready.shorthand]);
  expect((await listAttempts(storage)).some(({ ticketId }) => ticketId === other.id)).toBe(false);
});

test("turning off prevents future launches while preserving the dispatched implementation", async () => {
  const { ctx, storage, ticket } = await fixture();
  const first = await ticket("First");
  await ticket("Second");
  ctx.sessions.create = async () => {
    await configureAutoBuildCommand.run(ctx, { enabled: false });
    return createSessionResource();
  };
  expect((await autoBuildCommand.run(ctx, {})).started.map(({ ticket }) => ticket)).toEqual([first.shorthand]);
  expect(await listAttempts(storage)).toHaveLength(1);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([]);
});

test("a later ticket moved outside the saved filters during a batch is not launched", async () => {
  const { ctx, storage, ticket } = await fixture();
  const first = await ticket("First");
  const second = await ticket("Second");
  const track = await createTrackCommand.run(ctx, { name: "Other" });
  await storage.set("auto-build", {
    revision: "test",
    enabled: true,
    filter: { conjunction: "and", rules: [{ attributeId: (await readTrack(ctx))!.id, condition: "is-empty" }] },
  });
  ctx.sessions.create = async () => {
    await assignTrackCommand.run(ctx, { ticket: second.id, track: track.id });
    return createSessionResource();
  };
  expect((await autoBuildCommand.run(ctx, {})).started.map(({ ticket }) => ticket)).toEqual([first.shorthand]);
});

test("Auto build is off in a project with no saved mode", async () => {
  const { ctx, storage, ticket } = await fixture();
  await storage.delete("auto-build");
  await ticket("Ready");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([]);
  expect(await listAttempts(storage)).toEqual([]);
});

test("saved timeline filters exclude other ready tickets", async () => {
  const { ctx, storage, ticket } = await fixture();
  await ticket("Other work");
  const selected = await ticket("Ship the feature");
  await storage.set("auto-build", {
    revision: "test",
    enabled: true,
    filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Ship" }] },
  });
  expect((await autoBuildCommand.run(ctx, {})).started.map(({ ticket }) => ticket)).toEqual([selected.shorthand]);
  const later = await ticket("Ship another feature");
  expect((await autoBuildCommand.run(ctx, {})).started.map(({ ticket }) => ticket)).toEqual([later.shorthand]);
});

test("pauses Auto build after a launch failure so later checks do not retry it", async () => {
  const { ctx, storage, ticket } = await fixture();
  await ticket("Ready");
  ctx.workspaces.create = async () => {
    throw new Error("Workspace unavailable");
  };
  expect((await autoBuildCommand.run(ctx, {})).errors).toHaveLength(1);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
  expect((await autoBuildCommand.run(ctx, {})).errors).toEqual([]);
  expect(await listAttempts(storage)).toEqual([]);
});

test("fills a freed slot on a later check without restarting existing attempts", async () => {
  const { ctx, storage, ticket } = await fixture(1);
  const first = await ticket("First");
  const second = await ticket("Second");
  expect((await autoBuildCommand.run(ctx, {})).started.map(({ ticket }) => ticket)).toEqual([first.shorthand]);
  ctx.sessions.get = async () => ({ ...createSessionResource(), status: "completed" });
  expect((await autoBuildCommand.run(ctx, {})).started.map(({ ticket }) => ticket)).toEqual([second.shorthand]);
  expect(await listAttempts(storage)).toHaveLength(2);
});

test("turning off during readiness prevents an undispatched launch", async () => {
  const { ctx, storage, ticket } = await fixture();
  await ticket("Ready");
  let checks = 0;
  ctx.process.run = async ({ command }) => {
    if (command.includes("--verify")) {
      checks += 1;
      if (checks === 2) await configureAutoBuildCommand.run(ctx, { enabled: false });
    }
    return { exitCode: 0, stdout: "main-sha\n", stderr: "" };
  };
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([]);
  expect(await listAttempts(storage)).toEqual([]);
});

test("a failed batch preserves a newer enabled configuration", async () => {
  const { ctx, ticket } = await fixture();
  await ticket("Ready");
  const filter = {
    conjunction: "and" as const,
    rules: [{ attributeId: "title", condition: "contains" as const, value: "New" }],
  };
  ctx.workspaces.create = async () => {
    await configureAutoBuildCommand.run(ctx, { enabled: true, filter });
    throw new Error("Old launch failed");
  };
  expect((await autoBuildCommand.run(ctx, {})).errors).toHaveLength(1);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: true, filter });
});

test("a removed filter property pauses Auto build without broadening its scope", async () => {
  const { ctx, storage, ticket } = await fixture();
  await ticket("Ready");
  await storage.set("auto-build", {
    revision: "test",
    enabled: true,
    filter: {
      conjunction: "and",
      rules: [{ attributeId: "priority", condition: "is-any-of", value: ["default-priority-high"] }],
    },
  });
  expect((await autoBuildCommand.run(ctx, {})).started).toEqual([]);
  await deleteTicketTagCommand.run(ctx, { tagId: "default-priority" });
  await expect(autoBuildCommand.run(ctx, {})).rejects.toThrow("filters");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
  expect(await listAttempts(storage)).toEqual([]);
});

test("launch failures pause even while a configuration write holds its claim", async () => {
  const { ctx, storage, ticket } = await fixture();
  await ticket("Ready");
  const claims = storage.collection("timeline.write-claims");
  await claims.createIfAbsent("auto-build-mode", { key: "auto-build-mode", token: "configuration" });
  ctx.workspaces.create = async () => {
    throw new Error("Workspace unavailable");
  };
  expect((await autoBuildCommand.run(ctx, {})).errors).toHaveLength(1);
  await claims.delete("auto-build-mode");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
  expect((await autoBuildCommand.run(ctx, {})).errors).toEqual([]);
});
