import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { createWorkspacesApi } from "../extensions/command-environment/workspaces";
import { runWorkspaceProvisioning } from "./provision-coordinator";
import { resolveWorkspaceExecutionTarget } from "./workspace-provider-execution-target";
import { setupWorkspaceWorktree } from "./worktree-setup";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
let previousHome: string | undefined;
let previousDefaultExtensions: string | undefined;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "workspace-provider-setup-"));
  previousHome = process.env.PSTDIO_HOME;
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  handle = await createTestApp({ storageRoot: join(root, "storage") });
});

afterAll(async () => {
  await handle.close();
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  if (previousDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  rmSync(root, { recursive: true, force: true });
});

const createFixture = async (name: string) => {
  const repoPath = join(root, name);
  mkdirSync(repoPath);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repoPath, stdio: "pipe" });
  git("init", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  writeFileSync(join(repoPath, "README.md"), "workspace setup\n");
  git("add", "README.md");
  git("commit", "-m", "Initial commit");

  const projectResponse = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(projectResponse.status).toBe(201);
  const project = (await projectResponse.json()) as { id: string };
  const repoResponse = await handle.app.request(`/v1/projects/${project.id}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, path: repoPath }),
  });
  expect(repoResponse.status).toBe(201);
  const configPath = join(repoPath, ".pstdio", "config.json");
  const config = readFileSync(configPath, "utf8");
  writeFileSync(configPath, "{ invalid config");
  return { projectId: project.id, repoPath, configPath, config };
};

describe("local provider creation setup failures", () => {
  for (const entryPoint of ["http", "extension"] as const) {
    test(`${entryPoint} reports config failure and preserves the workspace for retry`, async () => {
      const fixture = await createFixture(`setup-${entryPoint}`);
      let response: Response | undefined;
      let failure: unknown;
      if (entryPoint === "http") {
        response = await handle.app.request("/v1/workspaces", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            project_id: fixture.projectId,
            provider_id: "pstdio.worktree",
          }),
        });
      } else {
        const workspaces = createWorkspacesApi(
          handle.deps,
          { projectId: fixture.projectId },
          { setupWorkspaceWorktree, runWorkspaceProvisioning },
        );
        try {
          await workspaces.create({ provider_id: "pstdio.worktree" });
        } catch (error) {
          failure = error;
        }
      }

      const workspaces = await handle.deps.workspaceService.list(fixture.projectId);
      const created = workspaces.filter((workspace) => !workspace.is_default);
      expect(created).toHaveLength(1);
      const workspace = created[0]!;
      expect(workspace).toMatchObject({
        provider_state: "ready",
        execution_kind: "local",
        initializing: false,
        provider_error_json: null,
      });
      expect(typeof workspace.setup_error).toBe("string");
      expect(workspace.setup_error).not.toBeEmpty();
      expect(existsSync(workspace.worktree_path!)).toBe(true);
      expect(await resolveWorkspaceExecutionTarget(handle.deps, workspace.id)).toBeUndefined();

      if (response) {
        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.code).toBe("internal_server_error");
        expect(body.error).toContain(workspace.id);
        expect(body.error).toContain(workspace.setup_error);
      } else {
        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toContain(workspace.id);
        expect((failure as Error).message).toContain(workspace.setup_error!);
      }

      writeFileSync(fixture.configPath, fixture.config);
      const recovered = await runWorkspaceProvisioning(handle.deps, {
        projectId: fixture.projectId,
        workspace,
        repoPath: fixture.repoPath,
      });
      expect(recovered).toMatchObject({
        id: workspace.id,
        worktree_path: workspace.worktree_path,
        provider_ref_json: workspace.provider_ref_json,
        provider_state: "ready",
        initializing: false,
        setup_error: null,
      });
      expect(await resolveWorkspaceExecutionTarget(handle.deps, workspace.id)).toMatchObject({
        root: workspace.worktree_path,
      });
      expect(await handle.deps.workspaceService.list(fixture.projectId)).toHaveLength(workspaces.length);
      expect(JSON.parse(readFileSync(join(workspace.worktree_path!, ".pstdio", "config.json"), "utf8"))).toMatchObject({
        workspace_id: workspace.id,
      });
    });
  }
});
