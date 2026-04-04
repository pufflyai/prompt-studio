import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitChanges } from "./commit";
import { git } from "./git";
import { createTempRepo, waitFor } from "./test-helpers";
import { createWorktree } from "./worktree";

const writeHook = (repoPath: string, hookName: string, script: string) => {
  const hooksDir = join(repoPath, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const path = join(hooksDir, hookName);
  writeFileSync(path, `#!/bin/sh\n${script}`);
  chmodSync(path, 0o755);
};

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

describe("commitChanges", () => {
  test("stages all and commits", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/commit", path: wtPath });

    await Bun.write(join(wtPath, "new-file.txt"), "content");

    const result = await commitChanges({
      worktreePath: wtPath,
      message: "add new file",
      stage: "all",
    });

    expect(result.sha).toHaveLength(40);
    expect(result.message).toBe("add new file");

    const log = await git(wtPath, ["log", "-1", "--format=%s"]);
    expect(log).toBe("add new file");
  });

  test("stages only tracked files", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/tracked", path: wtPath });

    // modify tracked file
    await Bun.write(join(wtPath, "README.md"), "# updated\n");
    // create untracked file
    await Bun.write(join(wtPath, "untracked.txt"), "should not be staged");

    const result = await commitChanges({
      worktreePath: wtPath,
      message: "update tracked only",
      stage: "tracked",
    });

    expect(result.sha).toHaveLength(40);

    // untracked file should still be untracked
    const status = await git(wtPath, ["status", "--porcelain"]);
    expect(status).toContain("?? untracked.txt");
  });

  test("commits only pre-staged changes with stage=none", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/none", path: wtPath });

    await Bun.write(join(wtPath, "staged.txt"), "staged");
    await Bun.write(join(wtPath, "unstaged.txt"), "unstaged");
    await git(wtPath, ["add", "staged.txt"]);

    const result = await commitChanges({
      worktreePath: wtPath,
      message: "staged only",
      stage: "none",
    });

    expect(result.sha).toHaveLength(40);

    const status = await git(wtPath, ["status", "--porcelain"]);
    expect(status).toContain("?? unstaged.txt");
    expect(status).not.toMatch(/^\?\? staged\.txt$/m);
    expect(status).not.toMatch(/^A\s+staged\.txt$/m);
  });

  test("pre-commit hook aborts commit on failure", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/hook-fail", path: wtPath });
    writeHook(repo.dir, "pre-commit", "exit 1");

    await Bun.write(join(wtPath, "file.txt"), "content");

    await expect(commitChanges({ worktreePath: wtPath, message: "should fail", repoPath: repo.dir })).rejects.toThrow(
      "HOOK pre-commit FAILED",
    );
  });

  test("post-commit hook runs after successful commit", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/hook-post", path: wtPath });
    writeHook(repo.dir, "post-commit", `echo "done" > "${repo.dir}/post-commit-marker.txt"`);

    await Bun.write(join(wtPath, "file.txt"), "content");

    await commitChanges({ worktreePath: wtPath, message: "with hook", repoPath: repo.dir });

    expect(await waitFor(() => existsSync(join(repo.dir, "post-commit-marker.txt")))).toBe(true);
  });

  test("pre-commit payload is available via stdin and field env vars", async () => {
    const wtPath = join(repo.dir, "wt-commit");
    await createWorktree({ repoRoot: repo.dir, branch: "task/payload", path: wtPath });

    const stdinPath = join(repo.dir, "pre-commit.payload.stdin.json");
    const envPath = join(repo.dir, "pre-commit.payload.env.json");
    writeHook(
      repo.dir,
      "pre-commit",
      `cat > "${stdinPath}"
printf '{"repo_path":"%s","worktree_path":"%s","branch":"%s","workspace":"%s","workspace_id":"%s","ticket":"%s","project_id":"%s","commit_message":"%s"}' \
"$PSTDIO_REPO_PATH" \
"$PSTDIO_WORKTREE_PATH" \
"$PSTDIO_BRANCH" \
"$PSTDIO_WORKSPACE" \
"$PSTDIO_WORKSPACE_ID" \
"$PSTDIO_TICKET" \
"$PSTDIO_PROJECT_ID" \
"$PSTDIO_COMMIT_MESSAGE" > "${envPath}"`,
    );

    await Bun.write(join(wtPath, "payload.txt"), "payload");
    await commitChanges({
      worktreePath: wtPath,
      message: "payload commit",
      repoPath: repo.dir,
      stage: "all",
      hookPayload: {
        branch: "workspace/PS-1_A1",
        workspace: "PS-1_A1",
        workspace_id: "ws-1",
        ticket: "PS-1",
        project_id: "proj-1",
      },
    });

    const stdinPayload = JSON.parse(readFileSync(stdinPath, "utf8"));
    const envPayload = JSON.parse(readFileSync(envPath, "utf8"));

    expect(envPayload.repo_path).toBe(stdinPayload.repo_path);
    expect(envPayload.worktree_path).toBe(stdinPayload.worktree_path);
    expect(envPayload.branch).toBe(stdinPayload.branch);
    expect(envPayload.workspace).toBe(stdinPayload.workspace);
    expect(envPayload.workspace_id).toBe(stdinPayload.workspace_id);
    expect(envPayload.ticket).toBe(stdinPayload.ticket);
    expect(envPayload.project_id).toBe(stdinPayload.project_id);
    expect(envPayload.commit_message).toBe(stdinPayload.commit_message);
    expect(stdinPayload.commit_message).toBe("payload commit");
    expect(stdinPayload.branch).toBe("workspace/PS-1_A1");
    expect(stdinPayload.workspace).toBe("PS-1_A1");
    expect(stdinPayload.workspace_id).toBe("ws-1");
    expect(stdinPayload.ticket).toBe("PS-1");
    expect(stdinPayload.project_id).toBe("proj-1");
    expect(stdinPayload.stage_policy).toBe("all");
  });
});
