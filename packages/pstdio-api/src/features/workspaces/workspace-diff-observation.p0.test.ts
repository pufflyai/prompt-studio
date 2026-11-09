import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "pstdio-wt";
import { EventBus } from "../sync/event-bus";
import { observeWorkspaceDiff } from "./workspace-diff-observation";

test.each([
  false,
  true,
])("shared diff observations see external edits and Git refs (linked worktree: %s)", async (linked) => {
  const repository = await mkdtemp(join(tmpdir(), "pstdio-diff-watch-"));
  let root = repository;
  await git(repository, ["init"]);
  await git(repository, [
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "--allow-empty",
    "-m",
    "Initial",
  ]);
  if (linked) {
    root = join(repository, "linked");
    await git(repository, ["worktree", "add", "-b", "observed", root, "HEAD"]);
  }
  await git(repository, ["branch", "logs/base"]);
  const workspace = {
    id: "workspace",
    project_id: "project",
    root_path: root,
    execution_kind: "local",
    provider_id: "pstdio.worktree",
    provider_state: "ready",
    initializing: false,
    provider_capabilities_json: { diff: true },
    deleted_at: null,
    setup_error: null,
  };
  const deps = { workspaceService: { get: async () => workspace }, eventBus: new EventBus() } as never;
  const edit = Promise.withResolvers<void>();
  const refs = Promise.withResolvers<void>();
  const phases: string[] = [];
  let phase = "edit";
  const first = await observeWorkspaceDiff(deps, { project_id: "project", workspace_id: "workspace" }, () =>
    phases.push("first"),
  );
  const second = await observeWorkspaceDiff(deps, { project_id: "project", workspace_id: "workspace" }, () => {
    phases.push("second");
    if (phase === "edit") edit.resolve();
    else refs.resolve();
  });
  try {
    expect(first.identity).toBe(second.identity);
    first.close();
    await writeFile(join(root, "external.txt"), "External editor");
    await edit.promise;
    expect(phases).not.toContain("first");
    phase = "refs";
    await git(repository, ["branch", "logs/other"]);
    await refs.promise;
    second.close();
    second.close();
    const third = await observeWorkspaceDiff(deps, { project_id: "project", workspace_id: "workspace" }, () => {});
    expect(third.identity).not.toBe(second.identity);
    third.close();
    await expect(
      observeWorkspaceDiff(deps, { project_id: "other", workspace_id: "workspace" }, () => {}),
    ).rejects.toThrow("not available");
  } finally {
    first.close();
    second.close();
    await rm(repository, { recursive: true, force: true });
  }
});
