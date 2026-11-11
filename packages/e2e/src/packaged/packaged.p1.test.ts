import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupDirs, createGitRepo } from "../cli/helpers";
import { getFreePort } from "../cli/start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "../cli/timeouts";
import { PSTDIO_E2E_DEFAULT_EXTENSIONS } from "../default-extensions";
import { buildBinary, PACKAGED_BINARY_PATH, runPackagedAsync, runPackagedSafe } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const BUILD_TIMEOUT = 180_000;

let api: Awaited<ReturnType<typeof startPackagedServe>>;
let homePath: string;

beforeAll(async () => {
  buildBinary();
  homePath = mkdtempSync(join(tmpdir(), "pstdio-packaged-lifecycle-home-"));
  dirs.push(homePath);
  const prepared = Promise.withResolvers<void>();
  let output = "";
  api = await startPackagedServe(
    homePath,
    {
      PSTDIO_DB_PATH: ":memory:",
      PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_DEFAULT_EXTENSIONS,
      PSTDIO_EXTENSION_WEBVIEW_BUILDS: "0",
      ...(process.env.E2E_BUN_CACHE_DIR ? { BUN_INSTALL_CACHE_DIR: process.env.E2E_BUN_CACHE_DIR } : {}),
    },
    PACKAGED_BINARY_PATH,
    undefined,
    (chunk, stream) => {
      if (stream !== "stdout") return;
      output += chunk.toString();
      const lines = output.split("\n");
      output = lines.pop()!;
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.phase === "default_extensions.register" && event.state === "completed") prepared.resolve();
        } catch {
          // CLI readiness output is interleaved with structured setup events.
        }
      }
    },
  );
  // Transport readiness intentionally precedes background default preparation.
  // This shared runtime's sixteen cold installs belong to its existing setup hook;
  // the separate auto-start case still creates its runtime inside the test.
  const stopped = () => prepared.reject(new Error("Packaged runtime stopped before default preparation completed"));
  api.child.once("close", stopped);
  try {
    await prepared.promise;
  } finally {
    api.child.off("close", stopped);
  }
}, BUILD_TIMEOUT + SETUP_TIMEOUT);

afterAll(async () => {
  if (api) await stopProcess(api.child);
  // The shared API owns each created project's watchers until it stops. Removing
  // a live workspace between cases can strand its Windows filesystem work.
  cleanupDirs(dirs);
});

const dirs: string[] = [];

// Keep the event loop available to drain the API pipes while it handles the CLI request.
const run = (args: string[], cwd: string) =>
  runPackagedAsync(args, cwd, { PSTDIO_API_URL: api.baseUrl, PSTDIO_HOME: homePath });

const runSafe = (args: string, cwd: string) =>
  runPackagedSafe(args, cwd, { PSTDIO_API_URL: api.baseUrl, PSTDIO_HOME: homePath });

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
      const unauthorized = await fetch(`${api.baseUrl}/runtime/ready`);
      expect(unauthorized.status).toBe(401);
      await unauthorized.body?.cancel();
      const headers = runtimeAuthorization(api.descriptor);
      const readiness = await fetch(`${api.baseUrl}/runtime/ready`, { headers });
      expect(readiness.ok).toBe(true);
      expect(await readiness.json()).toMatchObject({
        ok: true,
        instanceId: api.descriptor.instanceId,
        protocolVersion: api.descriptor.protocolVersion,
        ownerType: "persistent",
      });
      const repo = await createInitializedRepo("pkg-project");

      const list = await run(["projects", "list"], repo);
      expect(list).toContain("pkg-project");
      const projects = await fetch(`${api.baseUrl}/v1/projects`, { headers });
      expect(projects.ok).toBe(true);
      expect(await projects.json()).toContainEqual(expect.objectContaining({ name: "pkg-project" }));
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
