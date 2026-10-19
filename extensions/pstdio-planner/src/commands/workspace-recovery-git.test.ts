import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { putAttempt, readAttempt } from "../data/attempt-storage";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { autoBuildCommand } from "./auto-build";
import { fixture } from "./auto-build.fixture";
import { nextTicketsCommand } from "./next-tickets";
import { runAttemptCommand } from "./run-attempt";
import { sessionQuery } from "./session-query.fixture";

const run = async (command: string[]) => {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
};

test.each([
  "missing folder",
  "missing metadata",
  "broken gitdir",
])("Auto Build keeps scanning when an old workspace has %s", async (damage) => {
  const root = await mkdtemp(join(tmpdir(), "planner-recovery-git-"));
  try {
    const projectPath = join(root, "project");
    const workspacePath = join(root, "old-workspace");
    const git = async (...args: string[]) => {
      const result = await run(["git", "-C", projectPath, ...args]);
      expect(result.exitCode, result.stderr).toBe(0);
      return result.stdout.trim();
    };
    await mkdir(projectPath);
    await git("init", "-b", "main");
    await git(
      "-c",
      "user.name=Planner test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "Base",
    );
    const head = await git("rev-parse", "HEAD");
    await git("branch", "feature/surviving-work", head);
    if (damage !== "missing folder") await mkdir(workspacePath);
    if (damage === "broken gitdir") await writeFile(join(workspacePath, ".git"), "gitdir: ../removed-git-directory\n");

    const f = await fixture();
    await f.ctx.settings.set("implementation.defaultTargetBranch", "main");
    const ticket = await f.ticket("Continue previous work");
    const old = await runAttemptCommand.run(f.ctx, { ticket: ticket.id });
    const previous = { ...old.attempt, base: { workspaceId: null, headSha: head } };
    await putAttempt(f.storage, previous);
    const ready = await f.ticket("Independent ready work");
    const home = await f.ctx.workspaces.getDefault();
    f.ctx.workspaces.getDefault = async () => ({ ...home!, root_path: projectPath });
    f.ctx.workspaces.get = async (id) =>
      ({
        id,
        root_path: workspacePath,
        branch: "feature/surviving-work",
        execution_kind: "local",
        provider_capabilities_json: { diff: true },
      }) as never;
    f.ctx.sessions.get = async (id) => ({ ...old.session, id, status: "completed" });
    f.ctx.sessions.query = sessionQuery(async () => [{ ...old.session, status: "completed" }]);
    f.ctx.process.run = ({ command }) => run(command);

    const next = await nextTicketsCommand.run(f.ctx, {});
    expect(next.tickets).toContainEqual(
      expect.objectContaining({
        id: ticket.id,
        action: "recover-workspace",
        workspaceId: old.workspace.id,
        recoveryHeadSha: head,
      }),
    );
    expect(next.tickets).toContainEqual(expect.objectContaining({ id: ready.id, action: "start" }));
    expect(await autoBuildCommand.run(f.ctx, {})).toMatchObject({ prompted: true });
    expect((await readAutoBuildMode(f.ctx)).enabled).toBe(true);
    expect(await readAttempt(f.storage, old.workspace.id)).toEqual(previous);
    expect(await git("rev-parse", "HEAD")).toBe(head);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
