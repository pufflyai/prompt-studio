import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { stopSmokeProcess } from "./smoke-host";

test("stops and reaps a child before cleanup completes", async () => {
  const child = spawn(process.execPath, ["-e", 'console.log("ready");setInterval(()=>{},1000)'], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await once(child.stdout!, "data");
  await stopSmokeProcess(child);
  expect(child.signalCode).toBe("SIGTERM");
  await stopSmokeProcess(child);
  expect(() => process.kill(child.pid!, 0)).toThrow();
});

test("requests authenticated runtime shutdown and waits for host cleanup before returning", async () => {
  const root = mkdtempSync(join(tmpdir(), "smoke-host-stop-"));
  const marker = join(root, "closed");
  const child = spawn(
    process.execPath,
    [
      "-e",
      `const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
        const body = await request.json();
        if (new URL(request.url).pathname !== "/runtime/shutdown" ||
            request.headers.get("authorization") !== "Bearer fixture-token" ||
            body.instanceId !== "fixture-instance" || body.force !== true) return new Response(null, { status: 401 });
        setTimeout(async () => {
          await server.stop(true);
          await Bun.write(process.argv[1], "closed");
          process.exit(0);
        }, 20);
        return new Response(null, { status: 202 });
      }});
      console.log(JSON.stringify({ schemaVersion: 1, protocolVersion: 1, ownerType: "persistent", pid: process.pid,
        instanceId: "fixture-instance", token: "fixture-token", origin: server.url.origin, appVersion: "test",
        startedAt: new Date().toISOString() }));`,
      marker,
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  const lines = createInterface({ input: child.stdout! });
  try {
    const [line] = await once(lines, "line");
    await stopSmokeProcess(child, JSON.parse(line));
    expect(existsSync(marker)).toBe(true);
    expect(readFileSync(marker, "utf8")).toBe("closed");
    expect(child.exitCode).toBe(0);
  } finally {
    lines.close();
    await stopSmokeProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
