import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { waitForReady } from "./start-api";

test("API readiness reports child failure while a health request stalls", async () => {
  const server = Bun.serve({ port: 0, fetch: () => new Promise<Response>(() => {}) });
  const child = spawn(
    "bun",
    ["-e", "console.log('initializing database'); console.error('startup failed'); process.exit(9)"],
    { stdio: "pipe" },
  );
  try {
    const failure = await waitForReady(server.url.origin, child).catch((error: unknown) => error);
    expect(failure).toMatchObject({
      message: expect.stringMatching(/exited.*9[\s\S]*initializing database[\s\S]*startup failed/),
    });
  } finally {
    child.kill();
    await server.stop(true);
  }
}, 1_000);
