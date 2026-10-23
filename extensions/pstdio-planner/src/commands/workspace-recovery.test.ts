import { expect, test } from "bun:test";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { attemptSelectionsCollection, listAttempts, putAttempt, readAttempt } from "../data/attempt-storage";
import { putTicket } from "../data/collections";
import { fixture } from "./auto-build.fixture";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { nextTicketsCommand } from "./next-tickets";
import { runAttemptCommand } from "./run-attempt";
import { sessionQuery } from "./session-query.fixture";
import { sessionRecord } from "./session-record.fixture";
import { recoverySessionInput } from "./workspace-recovery";

async function lostWorkspace(source = "revision") {
  const f = await fixture();
  const ticket = await f.ticket("Recover previous implementation");
  const started = await runAttemptCommand.run(f.ctx, { ticket: ticket.id });
  const old = { ...started, session: sessionRecord(started.session) };
  const previous = {
    ...old.variant,
    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "submitted-head",
        changeRequestReportId: "old-report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent" as const, id: "old-agent", displayName: "Old agent" },
        reviews: [],
      },
    ],
  };
  await putAttempt(f.storage, previous);
  await putTicket(f.storage, {
    ...ticket,
    reviewLinks: [
      {
        id: "pr",
        provider: "github",
        kind: "pull_request",
        externalId: "1",
        title: null,
        url: "https://github.com/acme/tools/pull/1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  f.ctx.sessions.get = async (id) => (source === "missing owner" ? null : { ...old.session, id, status: "completed" });
  f.ctx.sessions.query = sessionQuery(async () => []);
  f.ctx.workspaces.get = async () =>
    source === "branch"
      ? ({
          id: old.workspace.id,
          branch: "feature/saved",
          root_path: "/lost",
          execution_kind: "local",
          provider_capabilities_json: { diff: true },
        } as never)
      : null;
  const run = f.ctx.process.run;
  f.ctx.process.run = async (input) => {
    const command = input.command;
    if (command.includes("/lost")) return { exitCode: 128, stdout: "", stderr: "Workspace folder missing" };
    if (command.includes("feature/saved^{commit}")) return { exitCode: 0, stdout: "branch-head\n", stderr: "" };
    if (command.includes("submitted-head^{commit}"))
      return { exitCode: source === "restart" ? 1 : 0, stdout: "submitted-head\n", stderr: "" };
    return run(input);
  };
  const created: Array<Parameters<typeof f.ctx.sessions.create>[0]> = [];
  const create = f.ctx.sessions.create;
  f.ctx.sessions.create = async (input) => {
    created.push(input);
    return create(input);
  };
  return { ...f, ticket, old, previous, created };
}

test("workspace recovery preserves a user stop after its final eligibility check", async () => {
  const f = await lostWorkspace();
  await expect(
    recoverySessionInput(
      f.ctx,
      {
        previous: (await readAttempt(f.storage, f.old.workspace.id))!,
        headSha: "submitted-head",
        detail: "Missing workspace",
      },
      async () => {
        f.ctx.sessions.get = async () => ({
          ...f.old.session,
          status: "cancelled",
          last_exit: { cause: "user_stop", startedAt: null, endedAt: "2026-10-22T10:00:00.000Z" },
        });
      },
    ),
  ).rejects.toThrow("stopped");
  expect(f.created).toHaveLength(0);
});

test.each([
  "branch",
  "revision",
  "restart",
  "missing owner",
])("missing work starts an informed recovery agent: %s", async (source) => {
  const f = await lostWorkspace(source);
  const next = await nextTicketsCommand.run(f.ctx, {});
  expect(next.tickets).toContainEqual(
    expect.objectContaining({ id: f.ticket.id, action: "recover-workspace", workspaceId: f.old.workspace.id }),
  );
  const result = await autoBuildDispatchCommand.run(f.ctx, { ticket: f.ticket.id, revision: "test" });
  expect(result).toMatchObject({ decision: "started", workspaceId: "workspace-2", sessionId: "session-2" });
  const replacement = await readAttempt(f.storage, "workspace-2");
  expect(replacement?.base.headSha).toBe("main-sha");
  expect(replacement?.revisions).toEqual([]);
  expect(await readAttempt(f.storage, f.old.workspace.id)).toMatchObject({ revisions: f.previous.revisions });
  expect(await readRetiredWorkspaceIds(f.storage)).toContain(f.old.workspace.id);
  expect(await attemptSelectionsCollection(f.storage).get(f.ticket.id)).toMatchObject({ workspaceId: "workspace-2" });
  expect(f.created[0]?.originalSessionId).toBe(source === "missing owner" ? undefined : f.old.session.id);
  expect(f.created[0]?.prompt).toContain("https://github.com/acme/tools/pull/1");
  expect(f.created[0]?.prompt).toContain("old-report");
  const expected = {
    branch: "branch-head",
    restart: "main-sha",
    revision: "submitted-head",
    "missing owner": "submitted-head",
  }[source];
  expect(f.created[0]?.prompt).toContain(expected);
});

test("a failed recovery launch leaves old history and selection unchanged", async () => {
  const f = await lostWorkspace();
  f.ctx.sessions.create = async () => {
    throw new Error("Cannot create session");
  };
  await expect(autoBuildDispatchCommand.run(f.ctx, { ticket: f.ticket.id, revision: "test" })).rejects.toThrow(
    "Cannot create session",
  );
  expect(await readAttempt(f.storage, f.old.workspace.id)).toEqual(f.previous);
  expect(await listAttempts(f.storage)).toHaveLength(1);
  expect(await attemptSelectionsCollection(f.storage).get(f.ticket.id)).toBeUndefined();
});

test.each([
  "capacity",
  "dependency",
  "live owner",
  "ambiguous",
])("workspace recovery keeps the real launch rules: %s", async (reason) => {
  const f = await lostWorkspace();
  if (reason === "capacity") await f.ctx.settings.set("automation.maxInProgress", 0);
  if (reason === "dependency") {
    const { createTicketCommand } = await import("./create-ticket");
    const prerequisite = await createTicketCommand.run(f.ctx, { title: "Unfinished prerequisite", statusId: "ready" });
    await putTicket(f.storage, { ...f.ticket, dependsOn: [prerequisite.id] });
  }
  if (reason === "live owner") f.ctx.sessions.get = async () => ({ ...f.old.session, status: "in_progress" });
  if (reason === "ambiguous") await putAttempt(f.storage, { ...f.previous, workspaceId: "other" });
  expect((await nextTicketsCommand.run(f.ctx, {})).tickets.some(({ id }) => id === f.ticket.id)).toBe(false);
  expect(await autoBuildDispatchCommand.run(f.ctx, { ticket: f.ticket.id, revision: "test" })).toMatchObject({
    decision: "wait",
  });
  expect(f.created).toHaveLength(0);
});

test("recovery does not replace an owner that resumes during workspace creation", async () => {
  const f = await lostWorkspace();
  const create = f.ctx.workspaces.create;
  f.ctx.workspaces.create = async (input) => {
    const workspace = await create(input);
    f.ctx.sessions.get = async () => ({ ...f.old.session, status: "in_progress" });
    return workspace;
  };
  await expect(autoBuildDispatchCommand.run(f.ctx, { ticket: f.ticket.id, revision: "test" })).rejects.toThrow(
    "no longer ready",
  );
  expect(await readAttempt(f.storage, f.old.workspace.id)).toEqual(f.previous);
  expect(f.created).toHaveLength(0);
});

test("a missing old base restarts on the project target and keeps the unavailable commit in its instructions", async () => {
  const f = await lostWorkspace("restart");
  await putAttempt(f.storage, { ...f.previous, base: { workspaceId: null, headSha: "gone-base" } });
  const run = f.ctx.process.run;
  f.ctx.process.run = async (input) =>
    input.command.includes("gone-base^{commit}") ? { exitCode: 1, stdout: "", stderr: "missing" } : run(input);
  expect(await autoBuildDispatchCommand.run(f.ctx, { ticket: f.ticket.id, revision: "test" })).toMatchObject({
    decision: "started",
  });
  expect(f.created[0]?.prompt).toContain("old-report");
  expect((await readAttempt(f.storage, "workspace-2"))?.base.headSha).toBe("main-sha");
});

test("a recovery capacity change during workspace setup prevents replacing the old attempt", async () => {
  const f = await lostWorkspace();
  const create = f.ctx.workspaces.create;
  f.ctx.workspaces.create = async (input) => {
    const workspace = await create(input);
    await f.ctx.settings.set("automation.maxInProgress", 0);
    return workspace;
  };
  await expect(autoBuildDispatchCommand.run(f.ctx, { ticket: f.ticket.id, revision: "test" })).rejects.toThrow(
    "no longer ready",
  );
  expect(await readAttempt(f.storage, f.old.workspace.id)).toEqual(f.previous);
  expect(f.created).toHaveLength(0);
});

test("recovery honors an explicit feature target without changing project settings", async () => {
  const f = await lostWorkspace();
  const run = f.ctx.process.run;
  f.ctx.process.run = async (input) =>
    input.command.some((part) => ["feature^{commit}", "feature-head^{commit}"].includes(part))
      ? { exitCode: 0, stdout: "feature-head\n", stderr: "" }
      : run(input);
  const settings = await f.ctx.settings.all();
  expect(
    await autoBuildDispatchCommand.run(f.ctx, { ticket: f.ticket.id, revision: "test", base: "feature" }),
  ).toMatchObject({ decision: "started" });
  expect((await readAttempt(f.storage, "workspace-2"))?.base.headSha).toBe("feature-head");
  expect(await f.ctx.settings.all()).toEqual(settings);
});
