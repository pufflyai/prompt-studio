import { afterEach, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getFreePort, waitForReady } from "./start-api";
import { TEST_TIMEOUT } from "./timeouts";

const PSTDIO_CLI = join(import.meta.dirname, "../../../pstdio/src/index.ts");
const SHARED_PSTDIO_HOME = mkdtempSync(join(tmpdir(), "pstdio-e2e-serve-home-"));

const runtimeAuthorization = () => {
  const descriptor = JSON.parse(readFileSync(join(SHARED_PSTDIO_HOME, "runtime.json"), "utf8")) as {
    token: string;
  };
  return { authorization: `Bearer ${descriptor.token}` };
};

const spawnServe = (port: number, storagePath: string, dbPath = ":memory:", owner = "persistent") => {
  const child = spawn("bun", ["run", PSTDIO_CLI, "serve", "--foreground", "--owner", owner, "--port", String(port)], {
    cwd: join(import.meta.dirname, "../.."),
    env: {
      ...process.env,
      PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      PSTDIO_DB_PATH: dbPath,
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_HOME: SHARED_PSTDIO_HOME,
      PSTDIO_STORAGE_PATH: storagePath,
    },
    stdio: "pipe",
  });

  return child;
};

const spawnDetachedServe = (port: number, storagePath: string, dbPath: string) => {
  const child = spawn("bun", ["run", PSTDIO_CLI, "serve", "--port", String(port)], {
    cwd: join(import.meta.dirname, "../.."),
    env: {
      ...process.env,
      PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      PSTDIO_DB_PATH: dbPath,
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_HOME: SHARED_PSTDIO_HOME,
      PSTDIO_STORAGE_PATH: storagePath,
    },
    stdio: "pipe",
  });

  return child;
};

const startServe = async (port: number, storagePath: string, dbPath = ":memory:") => {
  const child = spawnServe(port, storagePath, dbPath);

  await waitForReady(`http://localhost:${port}`);
  return child;
};

const waitForRuntimeDescriptor = async (path: string) => {
  const deadline = performance.now() + TEST_TIMEOUT;
  while (performance.now() < deadline) {
    if (existsSync(path)) {
      try {
        const value = JSON.parse(readFileSync(path, "utf8")) as { origin?: string; pid?: number };
        if (typeof value.origin === "string" && typeof value.pid === "number") return value;
      } catch {
        // Startup can still be replacing an older descriptor when this poll runs.
      }
    }
    await Bun.sleep(20);
  }
  throw new Error("Runtime descriptor was not published before the test deadline");
};

const stopChildren = async (children: ChildProcess[]) => {
  const exits = children.map(
    (candidate) =>
      new Promise<void>((resolve) => {
        if (candidate.exitCode !== null || candidate.signalCode !== null) {
          resolve();
          return;
        }
        candidate.once("exit", () => resolve());
        candidate.kill();
      }),
  );
  await Promise.all(exits);
};

describe("pstdio serve", () => {
  let child: ChildProcess | null = null;

  afterEach(async () => {
    const runningChild = child;
    child = null;
    if (!runningChild || runningChild.exitCode !== null || runningChild.signalCode !== null) return;

    const exited = new Promise<void>((resolve) => runningChild.once("exit", () => resolve()));
    runningChild.kill();
    await exited;
  });

  test(
    "reuses and promotes a running desktop-owned runtime",
    async () => {
      const firstPort = await getFreePort();
      const secondPort = await getFreePort();
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-concurrent-serve-"));
      const dbPath = join(tempRoot, "pstdio.db");
      child = spawnServe(firstPort, join(tempRoot, "first-storage"), dbPath, "desktop");
      await waitForReady(`http://localhost:${firstPort}`);

      const original = JSON.parse(readFileSync(join(SHARED_PSTDIO_HOME, "runtime.json"), "utf8")) as {
        instanceId: string;
        ownerType: string;
        pid: number;
      };

      const second = spawnDetachedServe(secondPort, join(tempRoot, "second-storage"), dbPath);
      const exitCode = await new Promise<number | null>((resolve) => second.once("exit", resolve));

      expect(exitCode).toBe(0);
      const promoted = JSON.parse(readFileSync(join(SHARED_PSTDIO_HOME, "runtime.json"), "utf8")) as {
        instanceId: string;
        ownerType: string;
        pid: number;
      };
      expect(promoted).toEqual({ ...original, ownerType: "persistent" });
      expect(promoted.pid).toBe(child.pid);

      const health = await fetch(`http://localhost:${firstPort}/healthz`);
      expect(health.ok).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "allows only the database owner to publish when foreground runtimes race",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-runtime-race-"));
      const dbPath = join(tempRoot, "pstdio.db");
      const descriptorPath = join(SHARED_PSTDIO_HOME, "runtime.json");
      const ports = await Promise.all([getFreePort(), getFreePort()]);
      const contenders = ports.map((port, index) => spawnServe(port, join(tempRoot, `storage-${index}`), dbPath));

      try {
        const runtime = await waitForRuntimeDescriptor(descriptorPath);
        const winner = contenders.find((candidate) => candidate.pid === runtime.pid);
        const loser = contenders.find((candidate) => candidate.pid !== runtime.pid);
        expect(winner).toBeDefined();
        expect(loser).toBeDefined();

        const loserExit =
          loser!.exitCode ?? (await new Promise<number | null>((resolve) => loser!.once("exit", resolve)));
        expect(loserExit).not.toBe(0);
        expect(JSON.parse(readFileSync(descriptorPath, "utf8")).pid).toBe(winner!.pid);
        expect((await fetch(`${runtime.origin}/healthz`)).ok).toBe(true);
      } finally {
        await stopChildren(contenders);
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "starts and serves API healthz",
    async () => {
      const port = await getFreePort();
      const storagePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-serve-"));
      child = await startServe(port, storagePath);

      const res = await fetch(`http://localhost:${port}/healthz`);
      expect(res.ok).toBe(true);

      const body = await res.json();
      expect(body).toEqual({ ok: true });
    },
    TEST_TIMEOUT,
  );

  test(
    "serves API routes under /v1",
    async () => {
      const port = await getFreePort();
      const storagePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-serve-"));
      child = await startServe(port, storagePath);

      const res = await fetch(`http://localhost:${port}/v1/projects`, { headers: runtimeAuthorization() });
      expect(res.ok).toBe(true);

      const body = (await res.json()) as unknown[];
      expect(Array.isArray(body)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "serves dashboard with text/html content-type at root",
    async () => {
      const port = await getFreePort();
      const storagePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-serve-"));
      child = await startServe(port, storagePath);

      const res = await fetch(`http://localhost:${port}/`);
      expect(res.ok).toBe(true);
      expect(res.headers.get("content-type")).toBe("text/html");
    },
    TEST_TIMEOUT,
  );

  test(
    "creates a project via serve API",
    async () => {
      const port = await getFreePort();
      const storagePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-serve-"));
      child = await startServe(port, storagePath);

      const createRes = await fetch(`http://localhost:${port}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(), "content-type": "application/json" },
        body: JSON.stringify({ name: "serve-test" }),
      });
      expect(createRes.ok).toBe(true);

      const project = (await createRes.json()) as { id: string; name: string };
      expect(project.name).toBe("serve-test");

      const listRes = await fetch(`http://localhost:${port}/v1/projects`, { headers: runtimeAuthorization() });
      const projects = (await listRes.json()) as { id: string; name: string }[];
      expect(projects.some((p) => p.name === "serve-test")).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
