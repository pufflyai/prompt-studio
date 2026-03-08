import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

export const waitForReady = async (url: string, timeoutMs = 5_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
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
  process: ChildProcess;
  stop: () => void;
};

export const startApi = async (): Promise<ApiInstance> => {
  const port = await getFreePort();
  const storagePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-storage-"));

  const child = spawn("bun", ["run", "../../packages/pstdio-api/src/server.ts"], {
    cwd: join(import.meta.dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      PSTDIO_DB_PATH: ":memory:",
      PSTDIO_STORAGE_PATH: storagePath,
    },
    stdio: "pipe",
  });

  const url = `http://localhost:${port}`;
  await waitForReady(url);

  return {
    url,
    port,
    storagePath,
    process: child,
    stop: () => child.kill(),
  };
};
