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

  describe("default post-create hook", () => {
    test(
      "project init scaffolds default post-create hook",
      () => {
        const repo = createInitializedRepo("scaffold-hooks");
        const hookPath = join(repo, ".pstdio", "hooks", "post-create");

        expect(existsSync(hookPath)).toBe(true);
        const content = readFileSync(hookPath, "utf8");
        expect(content).toContain("config.json");
        expect(content).toContain("pstdio tickets pull");
      },
      TEST_TIMEOUT,
    );

    test(
      "default post-create hook copies config and agent folders into worktree",
      async () => {
        const repo = createInitializedRepo("hook-copies-config");
        mkdirSync(join(repo, ".claude", "skills", "custom-skill"), { recursive: true });
        writeFileSync(join(repo, ".claude", "skills", "custom-skill", "SKILL.md"), "# custom");
        mkdirSync(join(repo, ".opencode", "skills", "custom-skill"), { recursive: true });
        writeFileSync(join(repo, ".opencode", "skills", "custom-skill", "SKILL.md"), "# custom");
        const workspace = await createWorkspaceInRepo(repo);
        expect(workspace.worktree_path).toBeTruthy();

        // post-create is fire-and-forget, give it a moment
        await new Promise((r) => setTimeout(r, 1000));

        const wtConfigPath = join(workspace.worktree_path!, ".pstdio", "config.json");
        expect(existsSync(wtConfigPath)).toBe(true);
        expect(existsSync(join(workspace.worktree_path!, ".claude", "skills", "custom-skill", "SKILL.md"))).toBe(true);
        expect(existsSync(join(workspace.worktree_path!, ".opencode", "skills", "custom-skill", "SKILL.md"))).toBe(
          true,
        );

        const config = JSON.parse(readFileSync(wtConfigPath, "utf8")) as { project_id: string };
        const repoConfig = JSON.parse(readFileSync(join(repo, ".pstdio", "config.json"), "utf8")) as {
          project_id: string;
        };
        expect(config.project_id).toBe(repoConfig.project_id);
      },
      TEST_TIMEOUT,
    );
  });

  describe("hook CRUD via API", () => {
    test(
      "creates, reads, updates, and deletes a hook via API",
      async () => {
        const repo = createInitializedRepo("hook-crud-api");
        const configPath = join(repo, ".pstdio", "config.json");
        const config = JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string };
        const projectId = config.project_id;

        // create a hook via API
        const putRes = await fetch(`${api.url}/v1/projects/${projectId}/hooks/pre-merge`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: "bun run test" }),
        });
        expect(putRes.status).toBe(204);

        // verify file was created
        expect(existsSync(join(repo, ".pstdio", "hooks", "pre-merge"))).toBe(true);
        expect(readFileSync(join(repo, ".pstdio", "hooks", "pre-merge"), "utf8")).toBe("bun run test");

        // list hooks and verify
        const listRes = await fetch(`${api.url}/v1/projects/${projectId}/hooks`);
        expect(listRes.status).toBe(200);
        const hooks = (await listRes.json()) as Array<{ name: string; content: string | null }>;
        const preMerge = hooks.find((h) => h.name === "pre-merge");
        expect(preMerge?.content).toBe("bun run test");

        // update the hook
        const updateRes = await fetch(`${api.url}/v1/projects/${projectId}/hooks/pre-merge`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: "bun run test && bun run build" }),
        });
        expect(updateRes.status).toBe(204);
        expect(readFileSync(join(repo, ".pstdio", "hooks", "pre-merge"), "utf8")).toBe("bun run test && bun run build");

        // delete the hook
        const delRes = await fetch(`${api.url}/v1/projects/${projectId}/hooks/pre-merge`, {
          method: "DELETE",
        });
        expect(delRes.status).toBe(204);
        expect(existsSync(join(repo, ".pstdio", "hooks", "pre-merge"))).toBe(false);
      },
      TEST_TIMEOUT,
    );
  });
});
