import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PSTDIO_E2E_DEFAULT_EXTENSIONS } from "../default-extensions";
import { stopChildProcess } from "../scripts/child-process";
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
      const res = await fetch(`${url}/healthz`, {
        signal: AbortSignal.timeout(Math.max(1, Math.ceil(deadline - performance.now()))),
      });
      await res.body?.cancel();
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await Bun.sleep(Math.max(0, Math.min(200, deadline - performance.now())));
  }
  throw new Error(`API did not become ready within ${timeoutMs}ms`);
};

export type ApiInstance = {
  url: string;
  port: number;
  storagePath: string;
  homePath: string;
  process: ChildProcess;
  stop: () => Promise<void>;
};

interface StartApiOptions {
  /**
   * Tests must select the fixture harness or provide a controlled executable
   * for the provider they exercise.
   */
  env?: Record<string, string>;
  eventBusBufferSize?: number;
}

export const startApi = async (options: StartApiOptions = {}) => {
  const port = await getFreePort();
  const homePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-home-"));
  const storagePath = join(homePath, "storage");

  const child = spawn("bun", ["run", "../../packages/pstdio-api/src/server.ts"], {
    cwd: join(import.meta.dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      PSTDIO_DB_PATH: ":memory:",
      PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_DEFAULT_EXTENSIONS,
      PSTDIO_EXTENSION_WEBVIEW_BUILDS: "0",
      PSTDIO_EVENT_BUS_BUFFER_SIZE:
        options.eventBusBufferSize !== undefined ? String(options.eventBusBufferSize) : undefined,
      PSTDIO_HOME: homePath,
      HOME: homePath,
      ...options.env,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-16_384);
  });
  const stop = async () => {
    await stopChildProcess(child);
    rmSync(homePath, { recursive: true, force: true });
  };
  const url = `http://127.0.0.1:${port}`;
  try {
    await waitForReady(url);
  } catch (error) {
    await stop();
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${stderr}`.trim());
  }

  return {
    url,
    port,
    storagePath,
    homePath,
    process: child,
    stop,
  };
};
