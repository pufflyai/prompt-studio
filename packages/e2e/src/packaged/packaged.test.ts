import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createTempDir, shutdownApiViaHttp } from "../cli/helpers";
import { type ApiInstance, getFreePort, startApi, waitForReady } from "../cli/start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "../cli/timeouts";
import { buildBinary, PACKAGED_BINARY_PATH, runPackaged, runPackagedSafe } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;

let api: ApiInstance;

beforeAll(async () => {
  buildBinary();
  api = await startApi();
}, BUILD_TIMEOUT + SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const dirs: string[] = [];

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) => runPackaged(args, cwd, { PSTDIO_API_URL: api.url });

const runSafe = (args: string, cwd: string) => runPackagedSafe(args, cwd, { PSTDIO_API_URL: api.url });

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  run(`projects create ${name}`, repo);
  return repo;
};

describe("packaged pstdio — project lifecycle", () => {
  test(
    "creates a project and lists it",
    async () => {
      const repo = createInitializedRepo("pkg-project");

      const list = run("projects list", repo);
      expect(list).toContain("pkg-project");
    },
    TEST_TIMEOUT,
  );

  test(
    "repairs a stale extracted hooks cache when the compiled server runs on an isolated db and port",
    async () => {
      const repo = createGitRepo();
      const fakeHome = createTempDir();
      const fakeBin = createTempDir();
      const storageDir = createTempDir();
      const dbPath = join(fakeHome, "pstdio-test.db");
      const extractedRoot = join(tmpdir(), "pstdio-files");
      dirs.push(repo, fakeHome, fakeBin, storageDir);

      const port = await getFreePort();
      const url = `http://localhost:${port}`;
      const claudePath = join(fakeBin, "claude");
      writeFileSync(
        claudePath,
        '#!/bin/sh\nif [ "$1" = "--version" ]; then\n  echo "claude 1.0.0"\n  exit 0\nfi\nexit 1\n',
      );
      chmodSync(claudePath, 0o755);

      rmSync(extractedRoot, { recursive: true, force: true });
      mkdirSync(join(extractedRoot, "hooks"), { recursive: true });
      mkdirSync(join(extractedRoot, "templates"), { recursive: true });
      writeFileSync(join(extractedRoot, "hooks", "post-worktree-create."), "#!/bin/sh\necho stale\n");
      writeFileSync(join(extractedRoot, "hooks", "post-session-success."), "#!/bin/sh\necho stale\n");
      writeFileSync(join(extractedRoot, "hooks", "post-session-start."), "#!/bin/sh\necho stale\n");
      writeFileSync(join(extractedRoot, "hooks", "post-ticket-archive."), "#!/bin/sh\necho stale\n");
      writeFileSync(join(extractedRoot, "templates", "stale.txt"), "stale");

      const server = spawn(PACKAGED_BINARY_PATH, ["serve", "--port", String(port)], {
        env: {
          ...process.env,
          HOME: fakeHome,
          PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
          PSTDIO_DB_PATH: dbPath,
          PSTDIO_STORAGE_PATH: storageDir,
        },
        stdio: "ignore",
      });

      try {
        await waitForReady(url);

        runPackaged("projects create packaged-auto-start", repo, {
          HOME: fakeHome,
          PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
          PSTDIO_API_URL: url,
          PSTDIO_DB_PATH: dbPath,
          PSTDIO_STORAGE_PATH: storageDir,
        });

        const config = JSON.parse(readFileSync(join(repo, ".pstdio", "config.json"), "utf8")) as {
          project_id: string;
        };
        expect(config.project_id.length).toBeGreaterThan(0);
        const pluginsDir = join(repo, ".pstdio", "plugins");
        expect(existsSync(pluginsDir)).toBe(true);
        expect(readdirSync(pluginsDir).length).toBeGreaterThan(0);
        const skillsDir = join(repo, ".claude", "skills");
        expect(existsSync(skillsDir)).toBe(true);
        expect(readdirSync(skillsDir).length).toBeGreaterThan(0);
      } finally {
        await shutdownApiViaHttp(url);
        server.kill();
        rmSync(extractedRoot, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "registering a repo through the compiled API seeds bundled repo files for dashboard-created projects",
    async () => {
      const repo = createGitRepo();
      const fakeHome = createTempDir();
      const storageDir = createTempDir();
      const dbPath = join(fakeHome, "pstdio-test.db");
      dirs.push(repo, fakeHome, storageDir);

      const port = await getFreePort();
      const url = `http://localhost:${port}`;

      const server = spawn(PACKAGED_BINARY_PATH, ["serve", "--port", String(port)], {
        env: {
          ...process.env,
          HOME: fakeHome,
          PSTDIO_DB_PATH: dbPath,
          PSTDIO_STORAGE_PATH: storageDir,
        },
        stdio: "ignore",
      });

      try {
        await waitForReady(url);

        const createProjectResponse = await fetch(`${url}/v1/projects`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "dashboard-packaged-project" }),
        });
        expect(createProjectResponse.ok).toBe(true);
        const project = (await createProjectResponse.json()) as { id: string };

        const registerRepoResponse = await fetch(`${url}/v1/projects/${project.id}/repos`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "dashboard-packaged-project", path: repo }),
        });
        expect(registerRepoResponse.ok).toBe(true);

        expect(existsSync(join(repo, ".pstdio", "config.json"))).toBe(true);
        const pluginsDir = join(repo, ".pstdio", "plugins");
        expect(existsSync(pluginsDir)).toBe(true);
        expect(readdirSync(pluginsDir).length).toBeGreaterThan(0);
      } finally {
        await shutdownApiViaHttp(url);
        server.kill();
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "shows version",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const output = run("--version", repo);
      expect(output.trim()).toMatch(/\d+\.\d+\.\d+/);
    },
    TEST_TIMEOUT,
  );

  test(
    "installs bundled OpenCode plugin artifacts in packaged mode",
    () => {
      const repo = createInitializedRepo("pkg-opencode-plugin");

      run("agents install-plugins opencode", repo);
      expect(existsSync(join(repo, ".opencode", "plugins", "pstdio-session-bridge.js"))).toBe(true);

      const secondRun = run("agents install-plugins opencode", repo);
      expect(secondRun).toContain("All plugin artifacts already installed.");
    },
    TEST_TIMEOUT,
  );
});

describe("packaged pstdio — tickets", () => {
  test(
    "creates and lists a ticket",
    () => {
      const repo = createInitializedRepo("pkg-tickets");

      const createOutput = run('tickets create --content "Packaged test ticket"', repo);
      expect(createOutput).toContain("Created ticket");

      const listOutput = run("tickets list", repo);
      expect(listOutput).toContain("Packaged test ticket");
    },
    TEST_TIMEOUT,
  );
});

describe("packaged pstdio — error cases", () => {
  test(
    "fails outside a project",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const result = runSafe("templates list", repo);
      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );
});
