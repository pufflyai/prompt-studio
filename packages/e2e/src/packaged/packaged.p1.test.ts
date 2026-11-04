import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupDirs, createGitRepo } from "../cli/helpers";
import { type ApiInstance, getFreePort, startApi } from "../cli/start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "../cli/timeouts";
import { buildBinary, runPackagedAsync, runPackagedSafe } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;

let api: ApiInstance;

beforeAll(async () => {
  buildBinary();
  api = await startApi();
}, BUILD_TIMEOUT + SETUP_TIMEOUT);

afterAll(async () => {
  await api?.stop();
});

const dirs: string[] = [];

afterEach(() => {
  cleanupDirs(dirs);
});

// Keep the event loop available to drain the API pipes while it handles the CLI request.
const run = (args: string[], cwd: string) => runPackagedAsync(args, cwd, { PSTDIO_API_URL: api.url });

const runSafe = (args: string, cwd: string) => runPackagedSafe(args, cwd, { PSTDIO_API_URL: api.url });

const createInitializedRepo = async (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  await run(["projects", "create", name], repo);
  return repo;
};

describe("packaged pstdio — project lifecycle", () => {
  test(
    "creates a project and lists it",
    async () => {
      const repo = await createInitializedRepo("pkg-project");

      const list = await run(["projects", "list"], repo);
      expect(list).toContain("pkg-project");
    },
    TEST_TIMEOUT,
  );

  test(
    "shows version",
    async () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const output = await run(["--version"], repo);
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
        const output = await runPackagedAsync(["projects", "create", "packaged-autostart"], repo, {
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
    async () => {
      const startedAt = performance.now();
      const phase = (name: string) =>
        console.info(`Packaged tickets +${Math.round(performance.now() - startedAt)}ms: ${name}`);
      phase("create project");
      const repo = await createInitializedRepo("pkg-tickets");
      phase("project created; create ticket");
      const created = JSON.parse(await run(["tickets", "create", "--content", "Packaged test ticket"], repo));
      phase("ticket created; list tickets");
      expect(created.shorthand).toMatch(/^PT-\d+$/);
      expect(created.title).toBe("Packaged test ticket");

      const tickets = JSON.parse(await run(["tickets", "list"], repo));
      expect(tickets.map((ticket: { title: string }) => ticket.title)).toContain("Packaged test ticket");
      phase("tickets listed");
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
