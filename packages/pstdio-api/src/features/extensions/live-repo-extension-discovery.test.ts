import { afterEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../app";
import { resolveTestFilesRoot } from "../../test-utils/resolve-test-files-root";

// Real end-to-end coverage for live repo-local extension discovery: it boots the actual app
// (real installed-extension runtime + real `fs.watch`, no fakes), links an empty repo, then adds
// and edits an extension while the API keeps running — proving discovery without a restart/relink.

type AppHandle = Awaited<ReturnType<typeof createApp>>;

const tempRoots: string[] = [];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createGitRepo = (root: string, name: string) => {
  const repoPath = join(root, name);
  mkdirSync(repoPath, { recursive: true });
  execSync("git init", { cwd: repoPath, stdio: "pipe" });
  execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: "pipe" });
  execSync('git config user.name "Test User"', { cwd: repoPath, stdio: "pipe" });
  writeFileSync(join(repoPath, "README.md"), "# live repo\n");
  execSync("git add README.md", { cwd: repoPath, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoPath, stdio: "pipe" });
  return repoPath;
};

const writeExtension = (dir: string, name: string, version: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name,
      version,
      displayName: name,
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
      type: "module",
    }),
  );
  writeFileSync(join(dir, "extension.ts"), "export default {};\n");
};

const createProject = async (app: AppHandle["app"]) => {
  const response = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Live Repo Discovery" }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string }>;
};

const setEnv = (overrides: Record<string, string | undefined>) => {
  const previous = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
};

const pollUntil = async <T>(
  read: () => Promise<T | null>,
  nudge: () => void,
  intervalMs: number,
  maxAttempts: number,
) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const value = await read();
    if (value) return value;
    nudge();
    await wait(intervalMs);
  }
  return read();
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("live repo-local extension discovery", () => {
  test("discovers and updates a repo-local extension added after the API starts", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-live-discovery-"));
    tempRoots.push(root);
    const restoreEnv = setEnv({
      HOME: join(root, "home"),
      PSTDIO_HOME: join(root, "home", ".pstdio"),
      PSTDIO_WORKSPACES_PATH: join(root, "workspaces"),
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({ defaultExtensions: [] }),
    });

    let handle: AppHandle | undefined;

    try {
      handle = await createApp({
        dbPath: ":memory:",
        storagePath: join(root, "storage"),
        filesRoot: resolveTestFilesRoot(),
        extensionWebviewBuilds: false,
      });

      const repoPath = createGitRepo(root, "live-repo");
      const project = await createProject(handle.app);

      // Link the repo while it holds NO repo-local extensions (Scenario 3).
      const registerResponse = await handle.app.request(`/v1/projects/${project.id}/repos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "live-repo", path: repoPath }),
      });
      expect(registerResponse.status).toBe(201);

      const repoExtensionsRoot = join(repoPath, ".pstdio", "extensions");
      const sourcePath = join(repoExtensionsRoot, "live-tool");

      expect(await handle.deps.installedExtensionSourcesService.getBySourcePath(sourcePath)).toBeNull();

      // Add the extension AFTER startup; the running root watcher should pick it up live.
      writeExtension(sourcePath, "live-tool", "1.0.0");

      let touch = 0;
      const discovered = await pollUntil(
        async () => {
          const row = await handle?.deps.installedExtensionSourcesService.getBySourcePath(sourcePath);
          return row?.status === "loaded" ? row : null;
        },
        // Nudge the non-recursive root watcher with a fresh root entry in case the folder-create
        // event landed in the brief window before the watcher attached to the linked repo root.
        () => writeFileSync(join(repoExtensionsRoot, `.live-touch-${touch++}`), ""),
        250,
        40,
      );

      expect(discovered).toMatchObject({
        install_name: "live-tool",
        source_kind: "local_path",
        status: "loaded",
        version: "1.0.0",
      });

      const instances = await handle.deps.extensionInstancesService.list({
        scope_id: project.id,
        scope_type: "project",
      });
      expect(instances).toHaveLength(1);
      expect(instances[0]?.enabled).toBe(true);

      // Edit the extension; the source watcher attached during discovery should reload it live.
      writeExtension(sourcePath, "live-tool", "2.0.0");

      let edit = 0;
      const updated = await pollUntil(
        async () => {
          const row = await handle?.deps.installedExtensionSourcesService.getBySourcePath(sourcePath);
          return row?.version === "2.0.0" ? row : null;
        },
        () => writeFileSync(join(sourcePath, "extension.ts"), `export default {};\n// edit ${edit++}\n`),
        1200,
        25,
      );

      expect(updated?.version).toBe("2.0.0");
    } finally {
      await handle?.close();
      restoreEnv();
    }
  }, 60_000);
});
