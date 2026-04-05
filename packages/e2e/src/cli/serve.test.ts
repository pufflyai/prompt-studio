import { afterEach, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getFreePort, waitForReady } from "./start-api";
import { TEST_TIMEOUT } from "./timeouts";

const PSTDIO_CLI = join(import.meta.dirname, "../../../pstdio/src/index.ts");

const startServe = async (port: number, storagePath: string) => {
  const child = spawn("bun", ["run", PSTDIO_CLI, "serve", "--port", String(port)], {
    cwd: join(import.meta.dirname, "../.."),
    env: {
      ...process.env,
      PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      PSTDIO_DB_PATH: ":memory:",
      PSTDIO_STORAGE_PATH: storagePath,
    },
    stdio: "pipe",
  });

  await waitForReady(`http://localhost:${port}`);
  return child;
};

describe("pstdio serve", () => {
  let child: ChildProcess | null = null;

  afterEach(() => {
    child?.kill();
    child = null;
  });

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

      const res = await fetch(`http://localhost:${port}/v1/projects`);
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "serve-test" }),
      });
      expect(createRes.ok).toBe(true);

      const project = (await createRes.json()) as { id: string; name: string };
      expect(project.name).toBe("serve-test");

      const listRes = await fetch(`http://localhost:${port}/v1/projects`);
      const projects = (await listRes.json()) as { id: string; name: string }[];
      expect(projects.some((p) => p.name === "serve-test")).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
