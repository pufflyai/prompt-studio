import { expect, test } from "bun:test";
import { fixture } from "./auto-build.fixture";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { nextTicketsCommand } from "./next-tickets";
import { sessionQuery } from "./session-query.fixture";

test("query and dispatch use an explicit feature base without changing project settings", async () => {
  const f = await fixture();
  const ticket = await f.ticket("Feature acceptance");
  const run = f.ctx.process.run;
  f.ctx.process.run = async (input) =>
    input.command.includes("feature^{commit}") ? { exitCode: 0, stdout: "feature-head\n", stderr: "" } : run(input);
  let createdBase: unknown;
  const create = f.ctx.workspaces.create;
  f.ctx.workspaces.create = async (input) => {
    createdBase = input.params?.base;
    return create(input);
  };
  const settings = await f.ctx.settings.all();
  expect(await nextTicketsCommand.run(f.ctx, { base: "feature" })).toMatchObject({
    tickets: [expect.objectContaining({ id: ticket.id, baseHeadSha: "feature-head" })],
  });
  expect(
    await autoBuildDispatchCommand.run(f.ctx, { ticket: ticket.id, revision: "test", base: "feature" }),
  ).toMatchObject({ decision: "started" });
  expect(createdBase).toBe("feature-head");
  expect(await f.ctx.settings.all()).toEqual(settings);
});

test.each([
  "linked",
  "another ticket",
  "active writer",
])("dispatch preserves an existing draft workspace: %s", async (scenario) => {
  const f = await fixture();
  const ticket = await f.ticket("Continue preserved work");
  f.ctx.workspaces.get = async () =>
    ({
      id: "draft",
      project_id: f.ctx.projectId,
      root_path: "/repo/draft",
      execution_kind: "local",
      provider_id: "pstdio.worktree",
      provider_state: "ready",
      provider_capabilities_json: { diff: true },
      anchors_json: [{ type: "ticket", id: scenario === "another ticket" ? "other" : ticket.id }],
    }) as never;
  f.ctx.sessions.query = sessionQuery(async () =>
    scenario === "active writer" ? [{ id: "writer", title: "Writer", status: "in_progress" }] : [],
  );
  f.ctx.workspaces.create = async () => {
    throw new Error("Must preserve the chosen workspace");
  };
  const dispatch = autoBuildDispatchCommand.run(f.ctx, { ticket: ticket.id, revision: "test", workspaceId: "draft" });
  if (scenario === "linked") expect(await dispatch).toMatchObject({ decision: "started", workspaceId: "draft" });
  else await expect(dispatch).rejects.toThrow(scenario === "another ticket" ? "linked" : "session");
});

test("adopting a draft preserves its real Git branch, staged changes, and untracked files", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const path = await mkdtemp(join(tmpdir(), "planner-draft-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", path, ...args], { encoding: "utf8" }).trim();
  try {
    git("init", "-b", "feature/draft");
    git("config", "user.name", "Planner test");
    git("config", "user.email", "test@example.invalid");
    await Bun.write(join(path, "draft.ts"), "export const draft = 1;\n");
    git("add", ".");
    git("commit", "-m", "Initial draft");
    const head = git("rev-parse", "HEAD");
    await Bun.write(join(path, "draft.ts"), "export const draft = 2;\n");
    git("add", ".");
    await Bun.write(join(path, "notes.txt"), "Preserve this draft\n");
    const before = git("status", "--porcelain");
    const f = await fixture();
    const ticket = await f.ticket("Adopt real draft");
    f.ctx.workspaces.get = async () =>
      ({
        id: "draft",
        project_id: f.ctx.projectId,
        root_path: path,
        execution_kind: "local",
        provider_id: "pstdio.worktree",
        provider_state: "ready",
        provider_capabilities_json: { diff: true },
        anchors_json: [{ type: "ticket", id: ticket.id }],
      }) as never;
    const run = f.ctx.process.run;
    f.ctx.process.run = async (input) => {
      if (input.command[1] !== "-C" || input.command[2] !== path) return run(input);
      const result = Bun.spawnSync(input.command);
      return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
    };
    f.ctx.workspaces.create = async () => {
      throw new Error("No replacement workspace");
    };
    expect(
      await autoBuildDispatchCommand.run(f.ctx, { ticket: ticket.id, revision: "test", workspaceId: "draft" }),
    ).toMatchObject({ decision: "started", workspaceId: "draft" });
    expect(git("rev-parse", "HEAD")).toBe(head);
    expect(git("branch", "--show-current")).toBe("feature/draft");
    expect(git("status", "--porcelain")).toBe(before);
    expect(await Bun.file(join(path, "notes.txt")).text()).toBe("Preserve this draft\n");
    const { attemptEventsCollection, readAttempt } = await import("../data/attempt-storage");
    expect((await attemptEventsCollection(f.storage).list())[0]?.commitSha).toBe(head);
    expect((await readAttempt(f.storage, "draft"))?.base.headSha).toBe("main-sha");
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});
