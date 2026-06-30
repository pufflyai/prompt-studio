import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { cleanupDirs, createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { FLOW_TIMEOUT, SETUP_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("extension-lab") } });
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const dirs: string[] = [];

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string, timeout?: number) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url }, timeout);

const runSafe = (args: string, cwd: string, timeout?: number) =>
  runPstdioSafe(args, cwd, { PSTDIO_API_URL: api.url }, timeout);

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  execSync("git commit --allow-empty -m init", { cwd: repo, stdio: "pipe" });
  run(`projects create ${name}`, repo);
  return repo;
};

const readProjectId = (repo: string) => {
  const configPath = join(repo, ".pstdio", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string };
  return config.project_id;
};

describe("pstdio sessions create --workspace-id", () => {
  test(
    "creates a session linked to a workspace when using workspace shorthand",
    async () => {
      const repo = createInitializedRepo("session-ws-shorthand");
      const projectId = readProjectId(repo);

      const workspaceOutput = run("workspaces create", repo, FLOW_TIMEOUT);
      expect(workspaceOutput).toContain("Created workspace");
      const workspacesRes = await fetch(`${api.url}/v1/workspaces?project_id=${encodeURIComponent(projectId)}`);
      const workspaces = (await workspacesRes.json()) as Array<{ id: string; workspace_shorthand: string }>;
      const workspace = workspaces.find((candidate) => candidate.workspace_shorthand === "WS-1");
      expect(workspace).toBeTruthy();

      // Create a session using the workspace shorthand (not UUID) — previously returned 404
      const sessionResult = runSafe(
        `sessions create --workspace-id ${workspace!.workspace_shorthand} --prompt "test prompt"`,
        repo,
        FLOW_TIMEOUT,
      );
      expect(sessionResult.exitCode).toBe(0);
      expect(sessionResult.stdout).toContain("Created session");
      expect(sessionResult.stdout).toContain(`Workspace: ${workspace!.workspace_shorthand}`);

      // Verify the session appears in the project
      const sessionsRes = await fetch(`${api.url}/v1/sessions?project_id=${encodeURIComponent(projectId)}`);
      const sessions = (await sessionsRes.json()) as Array<{ id: string; title: string }>;
      expect(sessions.some((s) => s.title === "test prompt")).toBe(true);
    },
    FLOW_TIMEOUT,
  );
});
