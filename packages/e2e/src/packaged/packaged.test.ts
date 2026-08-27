import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupDirs, createGitRepo } from "../cli/helpers";
import { type ApiInstance, getFreePort, startApi } from "../cli/start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "../cli/timeouts";
import { buildBinary, runPackaged, runPackagedSafe } from "./packaged-helpers";

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

describe("packaged pstdio — auto-start", () => {
  test(
    "keeps the detached API alive after the launcher exits",
    async () => {
      const port = await getFreePort();
      const url = `http://localhost:${port}`;
      const repo = createGitRepo();
      const homePath = mkdtempSync(join(tmpdir(), "pstdio-packaged-autostart-home-"));
      dirs.push(repo, homePath);

      try {
        const output = runPackaged("projects create packaged-autostart", repo, {
          PSTDIO_API_PORT: String(port),
          PSTDIO_API_URL: url,
          PSTDIO_DB_PATH: ":memory:",
          PSTDIO_DISABLE_API_AUTO_START: "0",
          PSTDIO_HOME: homePath,
          PSTDIO_LOG_LEVEL: "info",
          PSTDIO_STORAGE_PATH: join(homePath, "storage"),
        });
        expect(output).toContain("packaged-autostart");

        for (let request = 0; request < 3; request += 1) {
          const response = await fetch(`${url}/healthz`);
          expect(response.ok).toBe(true);
          await Bun.sleep(50);
        }
      } finally {
        runPackagedSafe("close", repo, { PSTDIO_HOME: homePath });
      }
    },
    TEST_TIMEOUT,
  );
});

describe("packaged pstdio — tickets", () => {
  test(
    "creates and lists a ticket",
    () => {
      const repo = createInitializedRepo("pkg-tickets");

      const created = JSON.parse(run('tickets create --content "Packaged test ticket"', repo));
      expect(created.shorthand).toMatch(/^PT-\d+$/);
      expect(created.title).toBe("Packaged test ticket");

      const tickets = JSON.parse(run("tickets list", repo));
      expect(tickets.map((ticket: { title: string }) => ticket.title)).toContain("Packaged test ticket");
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

      const result = runSafe("tickets list", repo);
      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );
});
