import { afterEach, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePstdioPerformanceEndpoint } from "pstdio-paths";
import { openPerformanceEndpoint } from "./performance-endpoint";

const roots: string[] = [];
const endpointPath = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-perf-"));
  roots.push(root);
  return resolvePstdioPerformanceEndpoint({ env: { PSTDIO_HOME: root } });
};

const read = (path: string) =>
  new Promise<unknown>((resolve) => {
    const socket = connect(path);
    let body = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      body += chunk;
    });
    socket.on("end", () => resolve(JSON.parse(body)));
    socket.on("error", () => resolve(null));
  });

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe("performance endpoint", () => {
  test("answers each local connection with the current snapshot", async () => {
    const path = endpointPath();
    let reads = 0;
    const endpoint = await openPerformanceEndpoint(path, () => ({ reads: ++reads }));

    expect(await read(path)).toEqual({ reads: 1 });
    expect(await read(path)).toEqual({ reads: 2 });
    if (process.platform !== "win32") expect(statSync(path).mode & 0o777).toBe(0o600);

    await endpoint.close();
    if (process.platform !== "win32") expect(existsSync(path)).toBe(false);
    expect(await read(path)).toBeNull();
  });

  test("closes even when a client never closes its side", async () => {
    const path = endpointPath();
    const endpoint = await openPerformanceEndpoint(path, () => ({ ok: true }));
    const client = connect({ path, allowHalfOpen: true });
    client.resume();
    await new Promise((resolve) => client.once("end", resolve));

    const closed = await Promise.race([
      endpoint.close().then(() => "closed"),
      new Promise((resolve) => setTimeout(() => resolve("stalled"), 1_000)),
    ]);
    client.destroy();
    expect(closed).toBe("closed");
  });

  test.skipIf(process.platform === "win32")("replaces a socket left behind by a crashed app", async () => {
    const path = endpointPath();
    const crashed = spawn(process.execPath, [
      "-e",
      `require("node:net").createServer().listen(${JSON.stringify(path)}, () => console.log("ready"))`,
    ]);
    await new Promise<void>((resolve) => crashed.stdout.once("data", () => resolve()));
    // A killed process cannot remove its socket file.
    crashed.kill("SIGKILL");
    await new Promise((resolve) => crashed.once("exit", resolve));
    expect(existsSync(path)).toBe(true);

    const endpoint = await openPerformanceEndpoint(path, () => ({ ok: true }));
    expect(await read(path)).toEqual({ ok: true });
    await endpoint.close();
  });
});
