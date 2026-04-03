import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, PSTDIO_CLI } from "./helpers";
import {
  configureAgent,
  createAttemptWithSession,
  createInitializedRepo,
  createRun,
  createRunSafe,
  getAttemptStatusName,
  getProjectId,
  getWorkspace,
  type HookTestContext,
  registerRepo,
  updateSessionStatus,
  wait,
  writeHook,
} from "./hooks-infra";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const ctx: HookTestContext = { api: null!, dirs: [] };

beforeAll(async () => {
  api = await startApi();
  ctx.api = api;
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(ctx.dirs);
});

const updateAttemptStatus = async (workspaceId: string, status: string, sessionId?: string) => {
  const body: Record<string, string> = { status };
  if (sessionId) body.session_id = sessionId;

  return fetch(`${api.url}/v1/workspaces/${workspaceId}/attempt-status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
};

describe("attempt-status hooks", () => {
  test(
    "pre-hook receives worktree path in environment",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-worktree-path");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-attempt-worktree-path-repo");
      await configureAgent(ctx);

      writeHook(
        repo,
        "pre-attempt-status-review-ready",
        'if [ -z "$PSTDIO_WORKTREE_PATH" ]; then echo "missing worktree path" >&2; exit 1; fi\nif [ ! -d "$PSTDIO_WORKTREE_PATH" ]; then echo "invalid worktree path" >&2; exit 1; fi',
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "pre-attempt-worktree-path");
      const workspaceId = attempt.workspace.id;

      const res = await updateAttemptStatus(workspaceId, "review-ready");
      expect(res.status).toBe(200);
    },
    TEST_TIMEOUT,
  );

  test(
    "pre-hook rejects transition and leaves status unchanged",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-reject");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-attempt-reject-repo");
      await configureAgent(ctx);

      writeHook(repo, "pre-attempt-status-review-ready", 'echo "tests failing" >&2; exit 1');

      const { attempt } = await createAttemptWithSession(ctx, repo, "pre-attempt-reject");
      const workspaceId = attempt.workspace.id;

      // Set to running first
      await updateAttemptStatus(workspaceId, "wip");

      // Try to transition to review-ready — pre-hook should block it
      const res = await updateAttemptStatus(workspaceId, "review-ready");

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string; hook_output: string };
      expect(body.hook_output).toContain("tests failing");

      // Verify status is still running
      const ws = await getWorkspace(ctx, projectId, workspaceId);
      const statusName = await getAttemptStatusName(ctx, projectId, ws.attempt_status_id!);
      expect(statusName).toBe("wip");
    },
    TEST_TIMEOUT,
  );

  test(
    "CLI surfaces stdout from a customer-style review-ready validator",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-cli-stdout-message");

      const validatorsDir = join(repo, ".pstdio", "validators");
      mkdirSync(validatorsDir, { recursive: true });

      const validatorPath = join(validatorsDir, "mock-validation.sh");
      writeFileSync(
        validatorPath,
        `#!/bin/sh
set -eu

WORKTREE_PATH="\${1:-.}"
FILES_DIR="$WORKTREE_PATH/files"

if [ ! -d "$FILES_DIR" ]; then
  echo "Mock validation failed: missing directory $FILES_DIR"
  exit 1
fi

NON_GITKEEP_COUNT=$(find "$FILES_DIR" -maxdepth 1 -type f ! -name '.gitkeep' | wc -l | tr -d ' ')
if [ "$NON_GITKEEP_COUNT" -eq 0 ]; then
  echo "You should add your poems to the ./files folder"
  exit 1
fi

echo "Mock validation passed: found $NON_GITKEEP_COUNT files in $FILES_DIR"
`,
      );
      chmodSync(validatorPath, 0o755);

      writeHook(
        repo,
        "pre-attempt-status-review-ready",
        `set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VALIDATION_SCRIPT="$SCRIPT_DIR/../validators/mock-validation.sh"

sh "$VALIDATION_SCRIPT" "$PSTDIO_WORKTREE_PATH"
`,
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "pre-attempt-cli-stdout-message");
      mkdirSync(join(attempt.workspace.worktree_path!, "files"), { recursive: true });
      writeFileSync(join(attempt.workspace.worktree_path!, "files", ".gitkeep"), "");

      const runSafe = createRunSafe(ctx);
      const result = runSafe("workspaces set-status --status review-ready", attempt.workspace.worktree_path!);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Pre-hook rejected the transition");
      expect(result.stderr).toContain("You should add your poems to the ./files folder");
    },
    TEST_TIMEOUT,
  );

  test(
    "pre-hook allows transition when it exits zero",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-allow");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-attempt-allow-repo");
      await configureAgent(ctx);

      writeHook(repo, "pre-attempt-status-review-ready", "exit 0");

      const { attempt } = await createAttemptWithSession(ctx, repo, "pre-attempt-allow");
      const workspaceId = attempt.workspace.id;

      const res = await updateAttemptStatus(workspaceId, "review-ready");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { to_status: string; status_change_id: string };
      expect(body.to_status).toBe("review-ready");
      expect(body.status_change_id).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "transition succeeds when no hook script exists",
    async () => {
      const repo = createInitializedRepo(ctx, "no-hook-transition");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "no-hook-transition-repo");
      await configureAgent(ctx);

      // No hooks written — transition should work
      const { attempt } = await createAttemptWithSession(ctx, repo, "no-hook-transition");
      const workspaceId = attempt.workspace.id;

      const res = await updateAttemptStatus(workspaceId, "review-ready");
      expect(res.status).toBe(200);
    },
    TEST_TIMEOUT,
  );

  test(
    "response includes from_status and to_status",
    async () => {
      const repo = createInitializedRepo(ctx, "from-to-status");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "from-to-status-repo");
      await configureAgent(ctx);

      const { attempt } = await createAttemptWithSession(ctx, repo, "from-to-status");
      const workspaceId = attempt.workspace.id;

      // First transition
      await updateAttemptStatus(workspaceId, "wip");

      // Second transition
      const res = await updateAttemptStatus(workspaceId, "review-ready");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { from_status: string; to_status: string };
      expect(body.from_status).toBe("wip");
      expect(body.to_status).toBe("review-ready");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-attempt-status-review-ready fires when session ends after CLI set-status",
    async () => {
      const repo = createInitializedRepo(ctx, "post-attempt-session-end");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "post-attempt-session-end-repo");
      await configureAgent(ctx);

      const outputPath = join(repo, "post-attempt-status-review-ready-fired.txt");
      writeHook(repo, "post-attempt-status-review-ready", `echo "$PSTDIO_SESSION_ID" > "${outputPath}"`);

      const { attempt } = await createAttemptWithSession(ctx, repo, "post-attempt-session-end");
      expect(attempt.session).toBeTruthy();
      const run = createRun(ctx);

      run(
        `workspaces set-status --workspace "${attempt.workspace.workspace_shorthand}" --status review-ready --session-id "${attempt.session!.id}"`,
        repo,
      );

      await updateSessionStatus(ctx, attempt.session!.id, "completed");
      await wait(1000);

      expect(existsSync(outputPath)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test.skip(
    "surfaces validation details when a pre-hook follows up the active session",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-attempt-follow-up-message");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "pre-attempt-follow-up-message-repo");
      await configureAgent(ctx);

      const validatorsDir = join(repo, ".pstdio", "validators");
      mkdirSync(validatorsDir, { recursive: true });

      const validatorPath = join(validatorsDir, "mock-validation.sh");
      writeFileSync(
        validatorPath,
        `#!/bin/sh
set -eu

WORKTREE_PATH="\${1:-.}"
FILES_DIR="$WORKTREE_PATH/files"

if [ ! -d "$FILES_DIR" ]; then
  echo "Mock validation failed: missing directory $FILES_DIR"
  exit 1
fi

NON_GITKEEP_COUNT=$(find "$FILES_DIR" -maxdepth 1 -type f ! -name '.gitkeep' | wc -l | tr -d ' ')
if [ "$NON_GITKEEP_COUNT" -eq 0 ]; then
  echo "You should add your poems to the ./files folder"
  exit 1
fi
`,
      );
      chmodSync(validatorPath, 0o755);

      writeHook(
        repo,
        "pre-attempt-status-review-ready",
        `set -eu

PSTDIO_DEV_CLI="${PSTDIO_CLI}"

run_pstdio() {
  PSTDIO_API_URL="${api.url}" PSTDIO_DISABLE_API_AUTO_START=1 PSTDIO_DISABLE_EMBED_MANIFEST=1 bun run "$PSTDIO_DEV_CLI" "$@"
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VALIDATION_SCRIPT="$SCRIPT_DIR/../validators/mock-validation.sh"

if ! VALIDATION_OUTPUT=$(sh "$VALIDATION_SCRIPT" "$PSTDIO_WORKTREE_PATH" 2>&1); then
  run_pstdio sessions follow-up --id "$PSTDIO_SESSION_ID" \\
    --prompt "Validation failed. Fix the errors and mark the attempt review-ready again:

$VALIDATION_OUTPUT" || true

  printf '%s\\n\\n%s\\n' \\
    "Validation failed. Fix the errors and mark the attempt review-ready again:" \\
    "$VALIDATION_OUTPUT" >&2
  exit 1
fi`,
      );

      const { attempt } = await createAttemptWithSession(ctx, repo, "pre-attempt-follow-up-message");
      expect(attempt.session).toBeTruthy();
      mkdirSync(join(attempt.workspace.worktree_path!, "files"), { recursive: true });
      writeFileSync(join(attempt.workspace.worktree_path!, "files", ".gitkeep"), "");

      const sessionUpdate = await updateSessionStatus(ctx, attempt.session!.id, "in_progress");
      expect(sessionUpdate.status).toBe(200);
      const session = (await sessionUpdate.json()) as { status: string };
      expect(session.status).toBe("in_progress");

      const runSafe = createRunSafe(ctx);
      const directFollowUp = runSafe(`sessions follow-up --id "${attempt.session!.id}" --prompt "probe"`, repo);
      expect(directFollowUp.exitCode).toBe(1);
      expect(directFollowUp.stderr).toContain("Session is in_progress");

      const result = runSafe(
        `workspaces set-status --workspace "${attempt.workspace.workspace_shorthand}" --status review-ready --session-id "${attempt.session!.id}"`,
        repo,
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Validation failed. Fix the errors and mark the attempt review-ready again:");
      expect(result.stderr).toContain("You should add your poems to the ./files folder");
    },
    TEST_TIMEOUT,
  );
});
