import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import type { RuntimeDescriptor } from "pstdio/runtime";

const require = createRequire(import.meta.url);
const electronPath = require("electron") as string;
const appPath = resolve(import.meta.dirname, "../../dist/main.js");
const roots: string[] = [];

const environment = (values: Record<string, string>) => {
  const result = Object.fromEntries(
    Object.entries({ ...process.env, ...values }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  delete result.ELECTRON_RUN_AS_NODE;
  return result;
};

const createHome = () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-desktop-e2e-"));
  roots.push(home);
  return home;
};

test.afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

test("loads the existing runtime in a sandboxed window and detaches on quit", async () => {
  const token = "desktop-e2e-secret";
  const eventResponses = new Set<ServerResponse>();
  let authenticatedReady = false;
  const server = createServer((request, response) => {
    if (request.url === "/runtime/ready") {
      if (request.headers.authorization !== `Bearer ${token}`) {
        response.writeHead(401).end();
        return;
      }
      authenticatedReady = true;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ ok: true, protocolVersion: 1, instanceId: "runtime-e2e", ownerType: "persistent" }),
      );
      return;
    }
    if (request.url === "/runtime/browser-session") {
      if (request.headers.authorization !== `Bearer ${token}`) {
        response.writeHead(401).end();
        return;
      }
      response.setHeader("set-cookie", `pstdio_runtime_session=${token}; Path=/; HttpOnly; SameSite=Strict`);
      response.writeHead(204).end();
      return;
    }
    if (request.url === "/runtime/events") {
      if (request.headers.authorization !== `Bearer ${token}`) {
        response.writeHead(401).end();
        return;
      }
      response.setHeader("content-type", "text/event-stream");
      response.write(": connected\n\n");
      eventResponses.add(response);
      response.on("close", () => eventResponses.delete(response));
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end("<!doctype html><html><body><main>Existing Prompt Studio dashboard</main></body></html>");
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Electron test runtime did not bind a port");
  const home = createHome();
  mkdirSync(home, { recursive: true });
  const descriptor: RuntimeDescriptor = {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: process.pid,
    instanceId: "runtime-e2e",
    ownerType: "persistent",
    origin: `http://127.0.0.1:${address.port}`,
    token,
    appVersion: "0.25.2",
    startedAt: new Date().toISOString(),
  };
  writeFileSync(join(home, "runtime.json"), JSON.stringify(descriptor));

  const launchEnvironment = environment({ PSTDIO_HOME: home });
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [appPath],
    env: launchEnvironment,
  });
  try {
    const window = await electronApp.firstWindow();
    await expect(window.getByText("Existing Prompt Studio dashboard")).toBeVisible();
    expect(await window.evaluate(() => document.cookie)).toBe("");
    expect(await window.evaluate(() => typeof process)).toBe("undefined");
    expect(authenticatedReady).toBe(true);
    expect(
      await window.evaluate(() => Object.keys((globalThis as unknown as Window).promptStudioDesktop).sort()),
    ).toEqual([
      "cancelQuit",
      "confirmQuit",
      "copyDiagnostics",
      "getAppInfo",
      "getStartupState",
      "openLogs",
      "quitApp",
      "retryRuntime",
    ]);
    expect(
      await electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.webContents.session.isPersistent(),
      ),
    ).toBe(false);
    expect(await window.evaluate(() => Object.isFrozen((globalThis as unknown as Window).promptStudioDesktop))).toBe(
      true,
    );

    expect(
      await window.evaluate(() => (globalThis as unknown as Window).open("http://127.0.0.1:1/blocked")),
    ).toBeNull();
    expect(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    expect(await window.evaluate(async () => (await navigator.permissions.query({ name: "geolocation" })).state)).toBe(
      "denied",
    );

    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.minimize());
    const secondInstance = spawn(electronPath, [appPath], { env: launchEnvironment, stdio: "ignore" });
    const secondExitCode = await new Promise<number | null>((resolveExit) =>
      secondInstance.once("exit", (code) => resolveExit(code)),
    );
    expect(secondExitCode).toBe(0);
    expect(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMinimized())).toBe(
      false,
    );

    const closed = electronApp.waitForEvent("close");
    await electronApp.evaluate(({ app }) => app.quit());
    await closed;
    expect(
      (
        await fetch(`${descriptor.origin}/runtime/ready`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).ok,
    ).toBe(true);
  } finally {
    await electronApp.close().catch(() => {});
    for (const response of eventResponses) response.end();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
});

test("keeps startup failures in an actionable recovery window", async () => {
  const home = createHome();
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [appPath],
    env: environment({ PSTDIO_HOME: home }),
  });
  try {
    const window = await electronApp.firstWindow();
    await expect(window.getByRole("heading", { name: "Prompt Studio needs attention" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Open logs" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Quit" })).toBeVisible();
  } finally {
    await electronApp.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await electronApp.close().catch(() => {});
  }
});
