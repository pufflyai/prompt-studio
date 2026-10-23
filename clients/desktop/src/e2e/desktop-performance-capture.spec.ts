import { spawn, spawnSync } from "node:child_process";
import { on } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { registerPackagedCleanup, stopPackagedProcess, test } from "../testing/packaged-fixture";
import { removeTestDirectory } from "../testing/remove-test-directory";

const require = createRequire(import.meta.url);

test("CDP disconnect leaves active desktop capture and its process observer responsive", async () => {
  const root = await mkdtemp(join(tmpdir(), "desktop-capture-cdp-"));
  registerPackagedCleanup(() => removeTestDirectory(root));
  const server = createServer((request, response) => {
    if (request.url !== "/diagnostics/performance" || request.headers.authorization !== "Bearer fixture-token") {
      response.writeHead(401).end();
      return;
    }
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        pid: process.pid,
        heapUsedBytes: process.memoryUsage().heapUsed,
        externalBytes: process.memoryUsage().external,
        counters: {
          activeSessions: 0,
          retainedMessages: 0,
          subscribers: 0,
          queuedEvents: 0,
          queuedBytes: 0,
          extensionImports: 0,
        },
      }),
    );
  });
  registerPackagedCleanup(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Capture fixture did not bind a port");
  const main = join(root, "main.mjs");
  const observer = join(root, process.platform === "win32" ? "observer.exe" : "observer");
  for (const args of [
    [
      "build",
      join(import.meta.dirname, "performance-capture-cdp.fixture.ts"),
      "--target=node",
      "--format=esm",
      "--external=electron",
      "--outfile",
      main,
    ],
    [
      "build",
      fileURLToPath(new URL("./features/performance/process-observer.fixture.ts", import.meta.resolve("pstdio"))),
      "--compile",
      "--outfile",
      observer,
    ],
  ]) {
    const built = spawnSync("bun", args, { encoding: "utf8" });
    expect(built.status, built.stderr).toBe(0);
  }
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const application = spawn(
    require("electron") as string,
    [main, "--remote-debugging-port=0", `--user-data-dir=${join(root, "profile")}`],
    {
      env: {
        ...env,
        PSTDIO_CAPTURE_PID: String(process.pid),
        PSTDIO_CAPTURE_ORIGIN: `http://127.0.0.1:${address.port}`,
        PSTDIO_CAPTURE_OBSERVER: observer,
      },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      detached: process.platform !== "win32",
    },
  );
  registerPackagedCleanup(() => stopPackagedProcess(application));
  let stderr = "";
  application.stderr!.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const heartbeats: number[] = [];
  application.on("message", (message) => {
    if (typeof message === "object" && message && "kind" in message && message.kind === "heartbeat")
      heartbeats.push(Date.now());
  });
  const messages = on(application, "message", { close: ["exit"] });
  const next = async (kind: string) => {
    for (;;) {
      const step = await messages.next();
      if (step.done) throw new Error(`Capture fixture exited before ${kind}: ${stderr}`);
      const [message] = step.value;
      if (message.kind === "error") throw new Error(message.error);
      if (message.kind === kind) return message;
    }
  };
  await next("ready");
  await expect.poll(() => stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1]).toBeTruthy();
  const browser = await chromium.connectOverCDP(stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)![1]);
  const ping = setInterval(() => application.send("ping"), 1000);
  registerPackagedCleanup(() => clearInterval(ping));
  registerPackagedCleanup(async () => {
    await test.info().attach("capture-cdp-lifecycle", {
      contentType: "application/json",
      body: JSON.stringify({ heartbeats, stderr }),
    });
  });
  application.send("capture");
  const active = await next("capture");
  expect(active.snapshot.samples[0].processes[0].residentBytes).toBeGreaterThan(0);
  expect(active.snapshot.samples[0].backend.state).toBe("reply");
  await test.step("disconnect CDP while sampling remains active", () => browser.close());
  application.send("sample");
  const continued = await next("sample");
  expect(continued.snapshot.samples.length).toBeGreaterThan(active.snapshot.samples.length);
  application.send("stop");
  await next("stopped");
});
