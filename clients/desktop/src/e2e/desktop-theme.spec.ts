import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import type { RuntimeDescriptor } from "pstdio/runtime";
import type { DesktopStartupAppearance } from "../desktop-api";
import { removeTestDirectory } from "../testing/remove-test-directory";
import { waitForLifecyclePage, waitForWorkbenchPage } from "./desktop-pages";

const require = createRequire(import.meta.url);
const electronPath = require("electron") as string;
const appPath = resolve(import.meta.dirname, "../../dist/main.js");
const cleanup: Array<() => void | Promise<void>> = [];

const environment = (values: Record<string, string>) => {
  const result = Object.fromEntries(
    Object.entries({ ...process.env, ...values }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  delete result.ELECTRON_RUN_AS_NODE;
  return result;
};

const startPersistentRuntime = async (home: string) => {
  const token = "desktop-theme-secret";
  const eventResponses = new Set<ServerResponse>();
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/runtime/") && request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end();
      return;
    }
    if (request.url === "/runtime/ready") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ ok: true, protocolVersion: 1, instanceId: "theme-runtime", ownerType: "persistent" }),
      );
      return;
    }
    if (request.url === "/runtime/browser-session") {
      response.setHeader("set-cookie", `pstdio_runtime_session=${token}; Path=/; HttpOnly; SameSite=Strict`);
      response.writeHead(204).end();
      return;
    }
    if (request.url === "/runtime/events") {
      response.setHeader("content-type", "text/event-stream");
      response.write(": connected\n\n");
      eventResponses.add(response);
      response.on("close", () => eventResponses.delete(response));
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end("<!doctype html><html><body><main>Theme dashboard</main></body></html>");
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  cleanup.push(async () => {
    for (const response of eventResponses) response.end();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Electron test runtime did not bind a port");
  const descriptor: RuntimeDescriptor = {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: process.pid,
    instanceId: "theme-runtime",
    ownerType: "persistent",
    origin: `http://127.0.0.1:${address.port}`,
    token,
    appVersion: "0.25.2",
    startedAt: new Date().toISOString(),
  };
  writeFileSync(join(home, "runtime.json"), JSON.stringify(descriptor));
  return descriptor;
};

const launch = async (home: string, origin: string) => {
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [appPath, `--user-data-dir=${join(home, "electron-user-data")}`],
    env: environment({ PSTDIO_HOME: home }),
  });
  cleanup.push(async () => {
    await electronApp.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await electronApp.close().catch(() => {});
  });
  const lifecycle = await waitForLifecyclePage(electronApp.context());
  const workbench = await waitForWorkbenchPage(lifecycle, origin);
  return { electronApp, lifecycle, workbench };
};

test.afterEach(async () => {
  for (const action of cleanup.reverse()) await action();
  cleanup.length = 0;
});

test("opens in the saved theme instead of the system theme after a restart", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-desktop-theme-"));
  cleanup.push(() => removeTestDirectory(home));
  const descriptor = await startPersistentRuntime(home);
  const appearance: DesktopStartupAppearance = {
    themeId: "pstdio-dark",
    mode: "dark",
    tokens: {},
    backgroundColor: "rgb(7, 9, 14)",
  };

  const first = await launch(home, descriptor.origin);
  await first.electronApp.evaluate(({ nativeTheme }) => {
    nativeTheme.themeSource = "light";
  });
  // The dashboard saves the choice and reports what it shows through these preload actions.
  await first.workbench.evaluate(async (shown) => {
    const desktop = (globalThis as unknown as Window).promptStudioDesktop;
    await desktop.setWorkbenchItem("theme-preference", "pstdio-dark");
    await desktop.setStartupAppearance(shown);
  }, appearance);
  await expect
    .poll(() => first.lifecycle.evaluate(() => document.documentElement.getAttribute("data-color-mode")))
    .toBe("dark");
  const closed = first.electronApp.waitForEvent("close");
  await first.electronApp.evaluate(({ app }) => app.quit());
  await closed;

  const second = await launch(home, descriptor.origin);
  await second.electronApp.evaluate(({ nativeTheme }) => {
    nativeTheme.themeSource = "light";
  });
  const servedDocument = await second.lifecycle.evaluate(() =>
    fetch("pstdio://lifecycle/index.html").then((response) => response.text()),
  );
  expect(servedDocument).toMatch(/<html[^>]* class="dark theme-pstdio-dark"[^>]* data-color-mode="dark"/);
  expect(
    await second.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor()),
  ).toBe("#07090E");
  await expect
    .poll(() => second.lifecycle.evaluate(() => document.documentElement.className))
    .toContain("theme-pstdio-dark");
  expect(
    await second.workbench.evaluate(() => (globalThis as unknown as Window).promptStudioDesktop.getWorkbenchState()),
  ).toMatchObject({ values: { "theme-preference": "pstdio-dark" } });
});
