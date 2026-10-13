import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { stopChildProcess } from "../scripts/child-process";
import { startApi, waitForReady } from "./start-api";

test("readiness waits for a successful health response", async () => {
  let requests = 0;
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response("", { status: ++requests === 1 ? 503 : 200 }),
  });
  const child = spawn("bun", ["-e", "setInterval(() => {}, 1000)"], { stdio: "pipe" });
  try {
    await waitForReady(server.url.origin, child);
    expect(requests).toBe(2);
  } finally {
    await stopChildProcess(child);
    await server.stop(true);
  }
});

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
