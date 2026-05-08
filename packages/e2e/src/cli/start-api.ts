import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SETUP_TIMEOUT } from "./timeouts";

export const getFreePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to resolve free port"));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });

export const waitForReady = async (url: string, timeoutMs = SETUP_TIMEOUT) => {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    try {
      const res = await fetch(`${url}/healthz`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`API did not become ready within ${timeoutMs}ms`);
};

export type ApiInstance = {
  url: string;
  port: number;
  storagePath: string;
  homePath: string;
  process: ChildProcess;
  stop: () => void;
};

interface StartApiOptions {
  eventBusBufferSize?: number;
}

export const startApi = async (options: StartApiOptions = {}): Promise<ApiInstance> => {
  const port = await getFreePort();
  const homePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-home-"));
  const storagePath = join(homePath, "storage");

  const child = spawn("bun", ["run", "../../packages/pstdio-api/src/server.ts"], {
    cwd: join(import.meta.dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      PSTDIO_DB_PATH: ":memory:",
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_EVENT_BUS_BUFFER_SIZE:
        options.eventBusBufferSize !== undefined ? String(options.eventBusBufferSize) : undefined,
      PSTDIO_HOME: homePath,
      PSTDIO_AGENTS: "fake",
      HOME: homePath,
    },
    stdio: "pipe",
  });

  const url = `http://localhost:${port}`;
  await waitForReady(url);

  return {
    url,
    port,
    storagePath,
    homePath,
    process: child,
    stop: () => {
      child.kill();
      rmSync(homePath, { recursive: true, force: true });
    },
  };
};
