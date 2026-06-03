import { afterEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import { loadProjectExtensionRuntime } from "../../extensions/extension-command-runtime";

const tempRoots: string[] = [];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPath = async (path: string) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5_000) {
    if (existsSync(path)) return true;
    await wait(50);
  }
  return existsSync(path);
};

const createGitRepo = (root: string, name: string) => {
  const repoPath = join(root, name);
  mkdirSync(repoPath, { recursive: true });
  execSync("git init", { cwd: repoPath, stdio: "pipe" });
  execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: "pipe" });
  execSync('git config user.name "Test User"', { cwd: repoPath, stdio: "pipe" });
  writeFileSync(join(repoPath, "README.md"), "# custom repo\n");
  execSync("git add README.md", { cwd: repoPath, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoPath, stdio: "pipe" });
  return repoPath;
};

const writeRepoScopedDefaultExtension = (sourcePath: string, markerPath: string) => {
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify(
      {
        name: "repo-worktree-automation",
        version: "1.0.0",
        displayName: "Repo Worktree Automation",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
        pstdio: { scope: "repo" },
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `import { writeFileSync } from "node:fs";

export default {
  hooks: {
    marker: {
      eventId: "worktree.created",
      async handler(_ctx, payload) {
        writeFileSync(${JSON.stringify(markerPath)}, payload.worktreePath);
      },
    },
  },
};
`,
  );
};

const createProject = async (app: Awaited<ReturnType<typeof createApp>>["app"]) => {
  const response = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Repo Local Project" }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string }>;
};

const createTicket = async (app: Awaited<ReturnType<typeof createApp>>["app"], projectId: string) => {
  const response = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content: "# Repo local ticket" }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string }>;
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("repo-local default extensions", () => {
  test("loads the materialized worktree automation copy from an isolated custom repo", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-repo-local-extension-"));
    const defaultInstallName = "repo-worktree-automation";
    const defaultSourcePath = join(root, defaultInstallName);
    const markerPath = join(root, "repo-local-marker.txt");
    writeRepoScopedDefaultExtension(defaultSourcePath, markerPath);
    tempRoots.push(root);
    const previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
    const previousHome = process.env.HOME;
    const previousPstdioHome = process.env.PSTDIO_HOME;
    const previousWorkspacesPath = process.env.PSTDIO_WORKSPACES_PATH;
    process.env.HOME = join(root, "home");
    process.env.PSTDIO_HOME = join(root, "home", ".pstdio");
    process.env.PSTDIO_WORKSPACES_PATH = join(root, "workspaces");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify({
      defaultExtensions: [{ source: defaultSourcePath, installName: defaultInstallName, skipInstall: true }],
    });

    const handle = await createApp({
      dbPath: ":memory:",
      storagePath: join(root, "storage"),
      filesRoot: resolveTestFilesRoot(),
    });

    try {
      const repoPath = createGitRepo(root, "custom-repo");
      const project = await createProject(handle.app);
      const registerResponse = await handle.app.request(`/v1/projects/${project.id}/repos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "custom-repo", path: repoPath }),
      });
      expect(registerResponse.status).toBe(201);
      const repo = (await registerResponse.json()) as { id: string };

      const sourcePath = join(repoPath, ".pstdio", "extensions", defaultInstallName);
      expect(existsSync(join(sourcePath, "package.json"))).toBe(true);
      const installed = await handle.deps.installedExtensionSourcesService.getBySourcePath(sourcePath);
      expect(installed).toMatchObject({ source_kind: "local_path", source_path: sourcePath });

      const extensionEntry = join(sourcePath, "extension.ts");
      const { runtime } = await loadProjectExtensionRuntime(handle.deps, project.id);
      expect(runtime.hooks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventId: "worktree.created",
            id: `${defaultInstallName}.marker`,
            sourcePath: extensionEntry,
          }),
        ]),
      );

      const ticket = await createTicket(handle.app, project.id);
      const attemptResponse = await handle.app.request(`/v1/tickets/${ticket.id}/attempts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo_id: repo.id, mode: "worktree", start_session: false }),
      });
      expect(attemptResponse.status).toBe(201);
      const attempt = (await attemptResponse.json()) as {
        workspace: { worktree_path: string };
      };

      const markerCreated = await waitForPath(markerPath);
      if (!markerCreated) {
        const workspacesResponse = await handle.app.request(`/v1/workspaces?project_id=${project.id}`);
        throw new Error(`Repo-local marker was not created. Workspaces: ${await workspacesResponse.text()}`);
      }
      expect(readFileSync(markerPath, "utf8")).toBe(attempt.workspace.worktree_path);
    } finally {
      await handle.close();
      if (previousDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
      else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousPstdioHome;
      if (previousWorkspacesPath === undefined) delete process.env.PSTDIO_WORKSPACES_PATH;
      else process.env.PSTDIO_WORKSPACES_PATH = previousWorkspacesPath;
    }
  }, 15_000);
});
