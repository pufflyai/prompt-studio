import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { stopChildProcess } from "../scripts/child-process";
import { startApi, waitForReady } from "./start-api";

test("readiness waits for a successful health response", async () => {
  let requests = 0;
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response("", { status: ++requests === 1 ? 503 : 200 }),
  });
  try {
    await waitForReady(server.url.origin, 2_000);
    expect(requests).toBe(2);
  } finally {
    await server.stop(true);
  }
});

test("readiness enforces its deadline when the health endpoint never responds", async () => {
  const server = Bun.serve({ port: 0, fetch: () => new Promise<Response>(() => {}) });
  try {
    await expect(waitForReady(server.url.origin, 100)).rejects.toThrow("within 100ms");
  } finally {
    await server.stop(true);
  }
}, 1_000);

test("API teardown waits for the process to exit before removing its home", async () => {
  const api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: "[]" } });
  try {
    await api.stop();
    expect(api.process.exitCode !== null || api.process.signalCode !== null).toBe(true);
    expect(existsSync(api.homePath)).toBe(false);
  } finally {
    await stopChildProcess(api.process);
  }
});
