import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi();
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const dirs: string[] = [];

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });

const runSafe = (args: string, cwd: string) => runPstdioSafe(args, cwd, { PSTDIO_API_URL: api.url });

const writeHook = (repo: string, hookName: string, script: string) => {
  const hooksDir = join(repo, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(join(hooksDir, hookName), script);
};

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  execSync("git commit --allow-empty -m init", { cwd: repo, stdio: "pipe" });
  run(`projects create ${name}`, repo);
  return repo;
};

const createWorkspaceInRepo = async (repo: string) => {
  const createTicketOutput = run('tickets create --content "Hook test ticket"', repo);
  const ticketShorthand = createTicketOutput.match(/Created ticket (\S+)/)?.[1];
  expect(ticketShorthand).toBeTruthy();

  run(`workspaces create --id ${ticketShorthand}`, repo);

  const configPath = join(repo, ".pstdio", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string };

  const workspacesRes = await fetch(`${api.url}/v1/workspaces?project_id=${encodeURIComponent(config.project_id)}`);
  const workspaces = (await workspacesRes.json()) as Array<{
    id: string;
    workspace_shorthand: string;
    branch: string | null;
    worktree_path: string | null;
  }>;

  return workspaces[0];
};

describe("pstdio hooks", () => {
  describe("hooks list", () => {
    test(
      "shows all hooks with installed status",
      () => {
        const repo = createInitializedRepo("hooks-list");
        writeHook(repo, "pre-commit", "exit 0");
        writeHook(repo, "post-create", "echo hi");

        const output = run("hooks list", repo);

        expect(output).toContain("pre-commit");
        expect(output).toContain("post-create");
        expect(output).toContain("pre-merge");
      },
      TEST_TIMEOUT,
    );
  });

  describe("hooks run", () => {
    test(
      "runs a hook manually and shows output",
      () => {
        const repo = createInitializedRepo("hooks-run");
        writeHook(repo, "pre-commit", 'echo "manual hook output"');

        const output = run("hooks run pre-commit", repo);

        expect(output).toContain("manual hook output");
      },
      TEST_TIMEOUT,
    );

    test(
      "reports missing hook",
      () => {
        const repo = createInitializedRepo("hooks-run-missing");

        const output = run("hooks run pre-commit", repo);

        expect(output).toContain("No hook script found");
      },
      TEST_TIMEOUT,
    );

    test(
      "fails on non-zero exit",
      () => {
        const repo = createInitializedRepo("hooks-run-fail");
        writeHook(repo, "pre-commit", "exit 1");

        const result = runSafe("hooks run pre-commit", repo);

        expect(result.exitCode).not.toBe(0);
      },
      TEST_TIMEOUT,
    );
  });

  describe("env vars", () => {
    test(
      "passes PSTDIO_HOOK and PSTDIO_REPO_PATH to hook",
      () => {
        const repo = createInitializedRepo("hooks-env");
        writeHook(repo, "pre-commit", 'echo "$PSTDIO_HOOK"');

        const output = run("hooks run pre-commit", repo);

        expect(output).toContain("pre-commit");
      },
      TEST_TIMEOUT,
    );
  });

  describe("pre-remove", () => {
    test(
      "blocks workspace deletion on failure",
      async () => {
        const repo = createInitializedRepo("preremove-block");
        const workspace = await createWorkspaceInRepo(repo);
        writeHook(repo, "pre-remove", "exit 1");

        const result = runSafe(`workspaces delete --id ${workspace.workspace_shorthand}`, repo);

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain("HOOK pre-remove FAILED");
      },
      TEST_TIMEOUT,
    );
  });

  describe("post-remove", () => {
    test(
      "runs after workspace deletion",
      async () => {
        const repo = createInitializedRepo("postremove-run");
        const workspace = await createWorkspaceInRepo(repo);
        writeHook(repo, "post-remove", `echo "removed" > "${repo}/post-remove-marker.txt"`);

        run(`workspaces delete --id ${workspace.workspace_shorthand}`, repo);

        // post-remove is fire-and-forget
        await new Promise((r) => setTimeout(r, 500));
        expect(existsSync(join(repo, "post-remove-marker.txt"))).toBe(true);
      },
      TEST_TIMEOUT,
    );
  });

  describe("no hook = no-op", () => {
    test(
      "operations succeed normally without hook files",
      async () => {
        const repo = createInitializedRepo("noop-delete");
        const workspace = await createWorkspaceInRepo(repo);

        // delete should work without any hooks
        run(`workspaces delete --id ${workspace.workspace_shorthand}`, repo);
      },
      TEST_TIMEOUT,
    );
  });
});
