import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("the first diff read covers silent edits during watcher startup without a duplicate read", async () => {
  const { watchWorkspaceDiffFiles } = await import("./workspace-diff-filesystem");
  const root = await mkdtemp(join(tmpdir(), "pstdio-diff-startup-"));
  await git(root, ["init"]);
  const path = join(root, "unreported.txt");
  await writeFile(path, "Before registration");
  const registered = Promise.withResolvers<void>();
  const reading = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let reads = 0;
  const read = async () => {
    reads++;
    const value = await readFile(path, "utf8");
    reading.resolve();
    await release.promise;
    return value;
  };
  const pending = watchWorkspaceDiffFiles(
    root,
    () => {
      void read();
    },
    () => {
      registered.resolve();
      return { close() {} };
    },
    true,
  );
  const initial = pending.then(read);
  try {
    await registered.promise;
    // Cover the later half of the previous 100 ms grace + 100 ms reconciliation batch.
    await Bun.sleep(150);
    await writeFile(path, "Silent startup edit");
    await reading.promise;
    // Keep the finite read pending beyond the reconciliation deadline.
    await Bun.sleep(250);
    release.resolve();
    expect(await initial).toBe("Silent startup edit");
    expect(reads).toBe(1);
  } finally {
    release.resolve();
    (await pending).close();
    await rm(root, { recursive: true, force: true });
  }
});

test("cancelling diff watch admission releases its native observations without a late read", async () => {
  const { watchWorkspaceDiffFiles } = await import("./workspace-diff-filesystem");
  const root = await mkdtemp(join(tmpdir(), "pstdio-diff-startup-abort-"));
  await git(root, ["init"]);
  const registered = Promise.withResolvers<void>();
  const abort = new AbortController();
  let watches = 0;
  let closed = 0;
  let changes = 0;
  const pending = watchWorkspaceDiffFiles(
    root,
    () => changes++,
    () => {
      watches++;
      registered.resolve();
      return { close: () => closed++ };
    },
    true,
    abort.signal,
  );
  try {
    await registered.promise;
    abort.abort();
    await expect(pending).rejects.toHaveProperty("name", "AbortError");
    expect(closed).toBe(watches);
    await Bun.sleep(250);
    expect(changes).toBe(0);
  } finally {
    (await pending.catch(() => undefined))?.close();
    await rm(root, { recursive: true, force: true });
  }
});
