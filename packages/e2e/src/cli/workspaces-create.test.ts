import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

describe("pstdio workspaces create", () => {
  test(
    "stores workspace branch/path aligned to workspace shorthand",
    async () => {
      const repo = createInitializedRepo("workspace-create-parity");

      const createTicketOutput = run('tickets create --content "Workspace parity ticket"', repo);
      const ticketShorthand = createTicketOutput.match(/Created ticket (\S+)/)?.[1];
      expect(ticketShorthand).toBeTruthy();

      const createWorkspaceOutput = run(`workspaces create --id ${ticketShorthand}`, repo);
      expect(createWorkspaceOutput).toContain("Created workspace");

      const projectId = readProjectId(repo);
      const workspacesRes = await fetch(`${api.url}/v1/workspaces?project_id=${encodeURIComponent(projectId)}`);
      expect(workspacesRes.ok).toBe(true);
      const workspaces = (await workspacesRes.json()) as Array<{
        workspace_shorthand: string;
        branch: string | null;
        worktree_path: string | null;
      }>;
      expect(workspaces.length).toBe(1);

      const workspace = workspaces[0];
      expect(workspace.branch).toBe(`workspace/${workspace.workspace_shorthand}`);
      expect(workspace.worktree_path).toBeTruthy();
      expect(workspace.worktree_path!.endsWith(`/${workspace.workspace_shorthand}`)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "runs project startup script when creating a workspace",
    async () => {
      const repo = createInitializedRepo("workspace-create-startup-script");
      const startupScriptPath = join(repo, "startup.sh");
      writeFileSync(
        startupScriptPath,
        '#!/usr/bin/env bash\necho "workspace startup ok"\necho "done" > startup-marker.txt\n',
      );
      run(`projects startup-script set --file ${startupScriptPath}`, repo);

      const createTicketOutput = run('tickets create --content "Workspace startup ticket"', repo);
      const ticketShorthand = createTicketOutput.match(/Created ticket (\S+)/)?.[1];
      expect(ticketShorthand).toBeTruthy();

      const createWorkspaceOutput = run(`workspaces create --id ${ticketShorthand}`, repo);
      expect(createWorkspaceOutput).toContain("Created workspace");

      const projectId = readProjectId(repo);
      const workspacesRes = await fetch(`${api.url}/v1/workspaces?project_id=${encodeURIComponent(projectId)}`);
      expect(workspacesRes.ok).toBe(true);
      const workspaces = (await workspacesRes.json()) as Array<{
        id: string;
        workspace_shorthand: string;
        worktree_path: string | null;
      }>;
      expect(workspaces.length).toBe(1);

      const workspace = workspaces[0];
      expect(workspace.worktree_path).toBeTruthy();

      const markerPath = join(workspace.worktree_path!, "startup-marker.txt");
      expect(existsSync(markerPath)).toBe(true);
      expect(readFileSync(markerPath, "utf8")).toContain("done");

      const startupLogOutput = run(`workspaces startup-log --id ${workspace.workspace_shorthand}`, repo);
      expect(startupLogOutput).toContain("workspace startup ok");
    },
    TEST_TIMEOUT,
  );
});
