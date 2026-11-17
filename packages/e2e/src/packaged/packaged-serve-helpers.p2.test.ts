import { beforeAll, expect, test } from "bun:test";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium } from "@playwright/test";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

beforeAll(buildBinary);

test("browser sign-in completes authentication before the caller navigates", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-browser-sign-in-"));
  const runtime = await startPackagedServe(root);
  let browser: Browser | undefined;
  const loginClosed = Promise.withResolvers<void>();
  const proxy = createServer(async (request, response) => {
    request.socket.once("close", () => loginClosed.resolve());
    try {
      const upstream = await fetch(`${runtime.baseUrl}/runtime/browser-login`, {
        method: "POST",
        headers: { authorization: request.headers.authorization ?? "" },
      });
      response.writeHead(upstream.status, { "content-type": "application/json" });
      response.end(await upstream.text());
    } catch {
      response.writeHead(502);
      response.end();
    }
  });
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    proxy.listen(0, "127.0.0.1");
    await once(proxy, "listening");
    const address = proxy.address();
    if (!address || typeof address === "string") throw new Error("Login proxy did not bind a TCP port");
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
    await signInBrowser(page, { ...runtime.descriptor, origin: `http://127.0.0.1:${address.port}` });
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
    await page.context().close();
    await Promise.race([
      loginClosed.promise,
      new Promise<never>((_, reject) => {
        watchdog = setTimeout(() => reject(new Error("Browser login left its control connection open")), 1000);
      }),
    ]);
  } finally {
    clearTimeout(watchdog);
    proxy.closeAllConnections();
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    await browser?.close();
    await stopProcess(runtime.child);
    rmSync(root, { recursive: true, force: true });
  }
});
