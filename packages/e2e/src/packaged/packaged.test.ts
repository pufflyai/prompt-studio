import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
      mkdirSync(join(extractedRoot, "documentation"), { recursive: true });
      mkdirSync(join(extractedRoot, "hooks"), { recursive: true });
      mkdirSync(join(extractedRoot, "templates"), { recursive: true });
      writeFileSync(join(extractedRoot, "documentation", "index.md"), "# stale");
      writeFileSync(join(extractedRoot, "documentation", "navigation.json"), "[]");
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
        expect(existsSync(join(repo, ".pstdio", "hooks", "post-worktree-create"))).toBe(true);
        expect(existsSync(join(repo, ".pstdio", "hooks", "post-session-start"))).toBe(true);
        expect(existsSync(join(repo, ".pstdio", "hooks", "post-session-success"))).toBe(true);
        expect(existsSync(join(repo, ".pstdio", "hooks", "post-ticket-archive"))).toBe(true);
        expect(existsSync(join(repo, ".pstdio", "hooks", "post-worktree-create."))).toBe(false);
        expect(existsSync(join(repo, ".claude", "skills", "create-ticket", "SKILL.md"))).toBe(true);

        const response = await fetch(`${url}/v1/projects/${config.project_id}/hooks`);
        expect(response.ok).toBe(true);
        const hooks = (await response.json()) as { name: string; content: string | null }[];
        const installedHooks = hooks.filter((hook) => hook.content !== null).map((hook) => hook.name);
        expect(installedHooks).toEqual([
          "post-worktree-create",
          "post-session-start",
          "post-session-success",
          "post-ticket-archive",
        ]);
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
        expect(existsSync(join(repo, ".pstdio", "docs", "navigation.json"))).toBe(true);
        expect(existsSync(join(repo, ".pstdio", "docs", "index.md"))).toBe(true);
        expect(existsSync(join(repo, ".pstdio", "hooks", "post-worktree-create"))).toBe(true);
        expect(existsSync(join(repo, ".pstdio", "hooks", "post-session-start"))).toBe(true);
        expect(existsSync(join(repo, ".pstdio", "hooks", "post-session-success"))).toBe(true);
        expect(existsSync(join(repo, ".pstdio", "hooks", "post-ticket-archive"))).toBe(true);

        const hooksResponse = await fetch(`${url}/v1/projects/${project.id}/hooks`);
        expect(hooksResponse.ok).toBe(true);
        const hooks = (await hooksResponse.json()) as { name: string; content: string | null }[];
        const installedHooks = hooks.filter((hook) => hook.content !== null).map((hook) => hook.name);
        expect(installedHooks).toEqual([
          "post-worktree-create",
          "post-session-start",
          "post-session-success",
          "post-ticket-archive",
        ]);
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

describe("packaged pstdio — templates", () => {
  test(
    "lists bundled templates",
    () => {
      const repo = createInitializedRepo("pkg-templates");

      const output = run("templates list", repo);
      expect(output).toContain("ticket");
      expect(output).toContain("prd");
    },
    TEST_TIMEOUT,
  );

  test(
    "writes a template to docs",
    () => {
      const repo = createInitializedRepo("pkg-tpl-write");

      const output = run("templates write --name prd --target docs/prd/test-feature", repo);
      expect(output).toContain("Wrote template");

      const filePath = join(repo, ".pstdio", "docs", "prd", "test-feature.md");
      expect(existsSync(filePath)).toBe(true);
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
