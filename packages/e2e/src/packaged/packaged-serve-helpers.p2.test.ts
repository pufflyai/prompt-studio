import { beforeAll, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium } from "@playwright/test";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { signInBrowser, startPackagedServe, stopProcess, waitForPackagedReady } from "./packaged-serve-helpers";

beforeAll(buildBinary);

const shutdownFixture = (root: string, inheritedOutput = false) =>
  spawn(
    process.execPath,
    [
      "-e",
      `import {rmSync} from "node:fs";
      import {spawn} from "node:child_process";
      const instanceId = "fixture-instance";
      const server = Bun.serve({hostname: "127.0.0.1", port: 0, async fetch(request) {
        if (request.headers.get("authorization") !== "Bearer fixture-token") return new Response(null, {status: 401});
        if (new URL(request.url).pathname === "/runtime/ready")
          return Response.json({instanceId, protocolVersion: 1});
        const body = await request.json();
        if (new URL(request.url).pathname !== "/runtime/shutdown" || body.instanceId !== instanceId || !body.force)
          return new Response(null, {status: 400});
        setTimeout(async () => {
          await server.stop(true);
          await Bun.write(process.argv[2], "closed");
          rmSync(process.argv[1]);
          if (${inheritedOutput}) {
            const descendant = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {stdio: "inherit", detached: true});
            descendant.unref();
            await Bun.write(process.argv[3], String(descendant.pid));
          }
          process.exit(0);
        }, 20);
        return new Response(null, {status: 202});
      }});
      await Bun.write(process.argv[1], JSON.stringify({pid: process.pid, instanceId, ownerType: "persistent",
        origin: server.url.origin, token: "fixture-token", protocolVersion: 1}));`,
      join(root, "runtime.json"),
      join(root, "closed"),
      join(root, "descendant.pid"),
    ],
    { stdio: "pipe" },
  );

test("fixture shutdown waits for the runtime's authenticated cleanup", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-runtime-shutdown-"));
  const descriptorPath = join(root, "runtime.json");
  const marker = join(root, "closed");
  const child = shutdownFixture(root);
  try {
    await waitForPackagedReady(descriptorPath, child);
    await Promise.all([stopProcess(child), stopProcess(child)]);
    expect(child.exitCode).toBe(0);
    expect(existsSync(marker)).toBe(true);
    expect(existsSync(descriptorPath)).toBe(false);
  } finally {
    await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});

test("runner cancellation releases a shutdown wait when a descendant keeps output open", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-runtime-output-"));
  const child = shutdownFixture(root, true);
  const closed = once(child, "close");
  let stopped: Promise<unknown> | undefined;
  try {
    await waitForPackagedReady(join(root, "runtime.json"), child);
    const exited = once(child, "exit");
    let failure: unknown;
    stopped = stopProcess(child).catch((error: unknown) => {
      failure = error;
    });
    await exited;
    expect(child.exitCode).toBe(0);
    expect(() => process.kill(Number(readFileSync(join(root, "descendant.pid"), "utf8")), 0)).not.toThrow();
    await stopPendingTestProcesses();
    await Bun.sleep(0);
    expect(failure).toMatchObject({ name: "AbortError" });
  } finally {
    const descendant = Number(readFileSync(join(root, "descendant.pid"), "utf8"));
    process.kill(descendant);
    await closed;
    await stopped;
    await stopProcess(child).catch(() => {});
    rmSync(root, { recursive: true, force: true });
  }
});

test("browser sign-in completes authentication before the caller navigates", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-browser-sign-in-"));
  const runtime = await startPackagedServe(root);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const readJson = Response.prototype.json;
      Response.prototype.json = async function () {
        const value = await readJson.call(this);
        // The response event arrives before the dashboard finishes consuming its body.
        if (new URL(this.url).pathname === "/runtime/browser-session")
          await new Promise((resolve) => setTimeout(resolve, 150));
        return value;
      };
    });
    await signInBrowser(page, runtime.descriptor);
    const isAuthenticated = () =>
      page.evaluate(async () => {
        const secret = localStorage.getItem("pstdio.browserSession");
        const response = await fetch("/runtime/ready", {
          headers: secret ? { authorization: `Bearer ${secret}` } : {},
        });
        return response.status;
      });
    expect(await isAuthenticated()).toBe(200);
    await page.reload();
    expect(await isAuthenticated()).toBe(200);
  } finally {
    await browser?.close();
    await stopProcess(runtime.child);
    rmSync(root, { recursive: true, force: true });
  }
});
