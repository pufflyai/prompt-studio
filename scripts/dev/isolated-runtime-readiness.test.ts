import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForIsolatedRuntime } from "./isolated-runtime-readiness";

const cleanup: Array<() => void> = [];
const serve = (fetch: () => Response | Promise<Response>) => {
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch });
  cleanup.push(() => server.stop(true));
  return server.url.origin;
};
const createHome = () => {
  const home = mkdtempSync(join(tmpdir(), "isolated-runtime-ready-"));
  cleanup.push(() => rmSync(home, { recursive: true, force: true }));
  return home;
};

afterEach(() => {
  for (const close of cleanup.splice(0).reverse()) close();
});

test("returns the desktop token after health and descriptor readiness", async () => {
  const home = createHome();
  const url = serve(() => {
    writeFileSync(join(home, "runtime.json"), JSON.stringify({ token: "desktop-token" }));
    return new Response("ok");
  });
  expect(await waitForIsolatedRuntime({ url, pid: process.pid, home })).toBe("desktop-token");
});

test("accepts a healthy browser API without a desktop descriptor", async () => {
  const url = serve(() => new Response("ok"));
  expect(await waitForIsolatedRuntime({ url, pid: process.pid })).toBeUndefined();
});

test("aborts an unresponsive health request within the runtime startup budget", async () => {
  let requested = false;
  const url = serve(() => {
    requested = true;
    return new Promise<Response>(() => {});
  });
  await expect(waitForIsolatedRuntime({ url, pid: process.pid, timeoutMs: 100 })).rejects.toThrow("within 100ms");
  expect(requested).toBe(true);
});

test("fails when a healthy desktop runtime never publishes its descriptor", async () => {
  const home = createHome();
  const url = serve(() => new Response("ok"));
  await expect(waitForIsolatedRuntime({ url, pid: process.pid, home, timeoutMs: 100 })).rejects.toThrow("within 100ms");
});

test("reports an exited runtime process before waiting for health", async () => {
  const child = Bun.spawn([process.execPath, "-e", ""], { stdout: "ignore", stderr: "ignore" });
  await child.exited;
  await expect(waitForIsolatedRuntime({ url: "http://127.0.0.1:1", pid: child.pid })).rejects.toThrow("exited");
});
