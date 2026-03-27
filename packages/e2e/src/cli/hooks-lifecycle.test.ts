import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
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

const writeHook = (repo: string, hookName: string, script: string) => {
  const hooksDir = join(repo, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const path = join(hooksDir, hookName);
  writeFileSync(path, `#!/bin/sh\n${script}`);
  chmodSync(path, 0o755);
};

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  execSync("git commit --allow-empty -m init", { cwd: repo, stdio: "pipe" });
  run(`projects create ${name}`, repo);
  return repo;
};

const getProjectId = (repo: string) => {
  const configPath = join(repo, ".pstdio", "config.json");
  return (JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string }).project_id;
};

const registerRepo = async (projectId: string, repo: string, name: string) => {
  await fetch(`${api.url}/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, path: repo }),
  });
};

describe("hooks list — all hook types", () => {
  test(
    "lists session and ticket hooks alongside worktree hooks",
    () => {
      const repo = createInitializedRepo("hooks-list-all");
      const output = run("hooks list", repo);

      expect(output).toContain("pre-worktree-create");
      expect(output).toContain("post-worktree-create");
      expect(output).toContain("on-conflict");
      expect(output).toContain("post-session-start");
      expect(output).toContain("post-session-success");
      expect(output).toContain("post-session-fail");
      expect(output).toContain("post-session-resume");
      expect(output).toContain("post-session-await-input");
      expect(output).toContain("pre-ticket-creation");
      expect(output).toContain("post-ticket-creation");
      expect(output).toContain("pre-ticket-status-change");
      expect(output).toContain("post-ticket-status-change");
      expect(output).toContain("pre-ticket-archive");
      expect(output).toContain("post-ticket-archive");
      expect(output).toContain("pre-ticket-deletion");
      expect(output).toContain("post-ticket-deletion");
    },
    TEST_TIMEOUT,
  );
});

describe("ticket hooks via API", () => {
  test(
    "pre-ticket-creation hook can reject ticket creation",
    async () => {
      const repo = createInitializedRepo("hook-pre-ticket-reject");
      const projectId = getProjectId(repo);

      writeHook(repo, "pre-ticket-creation", 'echo "Missing description" >&2; exit 1');
      await registerRepo(projectId, repo, "hook-pre-ticket-reject-repo");

      const res = await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, user_prompt: "test" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("Missing description");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-ticket-creation hook fires after ticket is created",
    async () => {
      const repo = createInitializedRepo("hook-post-ticket-create");
      const projectId = getProjectId(repo);

      writeHook(repo, "post-ticket-creation", `cat > "${repo}/post-ticket-creation-payload.json"`);
      await registerRepo(projectId, repo, "hook-post-ticket-create-repo");

      const res = await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, user_prompt: "test ticket" }),
      });
      expect(res.status).toBe(201);

      await new Promise((r) => setTimeout(r, 500));
      expect(existsSync(join(repo, "post-ticket-creation-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "post-ticket-creation-payload.json"), "utf8"));
      expect(payload.shorthand).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "pre-ticket-deletion hook can reject deletion",
    async () => {
      const repo = createInitializedRepo("hook-pre-ticket-delete");
      const projectId = getProjectId(repo);
      await registerRepo(projectId, repo, "hook-pre-ticket-delete-repo");

      const createRes = await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, user_prompt: "to-delete" }),
      });
      expect(createRes.status).toBe(201);
      const ticket = (await createRes.json()) as { id: string };

      writeHook(repo, "pre-ticket-deletion", "exit 1");

      const deleteRes = await fetch(`${api.url}/v1/tickets/${ticket.id}`, { method: "DELETE" });
      expect(deleteRes.status).toBe(403);
    },
    TEST_TIMEOUT,
  );
});

describe("session hooks via API", () => {
  test(
    "post-session-start hook fires when session is created",
    async () => {
      const repo = createInitializedRepo("hook-session-start");
      const projectId = getProjectId(repo);

      writeHook(repo, "post-session-start", `cat > "${repo}/session-start-payload.json"`);
      await registerRepo(projectId, repo, "hook-session-start-repo");

      const res = await fetch(`${api.url}/v1/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, title: "test", prompt: "test", agent: "fake" }),
      });
      expect(res.status).toBe(201);

      await new Promise((r) => setTimeout(r, 500));
      expect(existsSync(join(repo, "session-start-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "session-start-payload.json"), "utf8"));
      expect(payload.session.id).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "post-session-success hook fires when session completes",
    async () => {
      const repo = createInitializedRepo("hook-session-success");
      const projectId = getProjectId(repo);

      writeHook(repo, "post-session-success", `cat > "${repo}/session-success-payload.json"`);
      await registerRepo(projectId, repo, "hook-session-success-repo");

      const createRes = await fetch(`${api.url}/v1/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, title: "test", prompt: "test", agent: "fake" }),
      });
      const session = (await createRes.json()) as { id: string };

      await fetch(`${api.url}/v1/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      await new Promise((r) => setTimeout(r, 500));
      expect(existsSync(join(repo, "session-success-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "session-success-payload.json"), "utf8"));
      expect(payload.session.status).toBe("completed");
    },
    TEST_TIMEOUT,
  );

  test(
    "post-session-fail hook fires when session fails",
    async () => {
      const repo = createInitializedRepo("hook-session-fail");
      const projectId = getProjectId(repo);

      writeHook(repo, "post-session-fail", `cat > "${repo}/session-fail-payload.json"`);
      await registerRepo(projectId, repo, "hook-session-fail-repo");

      const createRes = await fetch(`${api.url}/v1/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, title: "test", prompt: "test", agent: "fake" }),
      });
      const session = (await createRes.json()) as { id: string };

      await fetch(`${api.url}/v1/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "failed" }),
      });

      await new Promise((r) => setTimeout(r, 500));
      expect(existsSync(join(repo, "session-fail-payload.json"))).toBe(true);
      const payload = JSON.parse(readFileSync(join(repo, "session-fail-payload.json"), "utf8"));
      expect(payload.session.status).toBe("failed");
    },
    TEST_TIMEOUT,
  );
});

describe("hooks run — new hook types", () => {
  test(
    "can run ticket hooks manually (blocking)",
    () => {
      const repo = createInitializedRepo("hooks-run-session");
      writeHook(repo, "pre-ticket-creation", 'echo "blocking hook ran"');

      const output = run("hooks run pre-ticket-creation", repo);

      expect(output).toContain("blocking hook ran");
    },
    TEST_TIMEOUT,
  );

  test(
    "can run post-worktree-create hook manually (blocking)",
    () => {
      const repo = createInitializedRepo("hooks-run-ticket");
      writeHook(repo, "post-worktree-create", 'echo "setup hook ran"');

      const output = run("hooks run post-worktree-create", repo);

      expect(output).toContain("setup hook ran");
    },
    TEST_TIMEOUT,
  );
});
