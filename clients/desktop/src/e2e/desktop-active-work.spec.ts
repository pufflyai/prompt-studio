import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { waitForLifecyclePage, waitForWorkbenchPage } from "./desktop-pages";
import { startElectronTrace } from "./electron-trace";
import { acceptFocusedButton } from "./lifecycle-actions";

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

const stopProcess = async (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
};

test.afterEach(async () => {
  for (const action of cleanup.reverse()) await action();
  cleanup.length = 0;
});

test("recovers from refused shutdown and closes each quit confirmation", async () => {
  const token = "desktop-active-work-secret";
  const home = mkdtempSync(join(tmpdir(), "pstdio-desktop-active-work-"));
  const descriptorPath = join(home, "runtime.json");
  const runtimeProcess = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const eventResponses = new Set<ServerResponse>();
  const shutdownForces: boolean[] = [];
  let refuseForcedShutdown = true;
  cleanup.push(() => rmSync(home, { recursive: true, force: true }));
  cleanup.push(() => stopProcess(runtimeProcess));

  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${token}` && request.url?.startsWith("/runtime/")) {
      response.writeHead(401).end();
      return;
    }
    if (request.url === "/runtime/ready") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ ok: true, protocolVersion: 1, instanceId: "active-runtime", ownerType: "desktop" }),
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
    if (request.url === "/runtime/shutdown") {
      let requestBody = "";
      for await (const chunk of request) requestBody += String(chunk);
      const body = JSON.parse(requestBody) as { force?: boolean };
      const force = body.force === true;
      shutdownForces.push(force);
      if (!force) {
        response.setHeader("content-type", "application/json");
        response.writeHead(409).end(
          JSON.stringify({
            error: "runtime_active",
            activity: {
              sessions: [{ id: "session-1", label: "PS-217 implementation" }],
              terminals: [{ id: "terminal-1", label: "Desktop tests" }],
              jobs: [{ id: "job-1", label: "Package verification" }],
            },
          }),
        );
        return;
      }
      if (refuseForcedShutdown) {
        refuseForcedShutdown = false;
        response.writeHead(503).end();
        return;
      }
      response.writeHead(202).end();
      rmSync(descriptorPath, { force: true });
      await stopProcess(runtimeProcess);
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end(
      '<!doctype html><html><body><main>Owned Prompt Studio dashboard<textarea aria-label="Draft"></textarea></main></body></html>',
    );
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
    pid: runtimeProcess.pid!,
    instanceId: "active-runtime",
    ownerType: "desktop",
    origin: `http://127.0.0.1:${address.port}`,
    token,
    appVersion: "0.25.2",
    startedAt: new Date().toISOString(),
  };
  writeFileSync(descriptorPath, JSON.stringify(descriptor));

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [appPath],
    env: environment({ PSTDIO_HOME: home }),
  });
  const finishTrace = await startElectronTrace(electronApp.context(), "active-work");
  cleanup.push(async () => {
    await finishTrace();
    await electronApp.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await electronApp.close().catch(() => {});
  });

  const lifecycle = await waitForLifecyclePage(electronApp.context());
  await expect
    .poll(() => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible()))
    .toBe(true);
  const window = await waitForWorkbenchPage(lifecycle, descriptor.origin);
  await expect(window.getByText("Owned Prompt Studio dashboard")).toBeVisible();

  await window.getByRole("textbox", { name: "Draft" }).fill("Unsaved work");
  await electronApp.evaluate(({ app }) => app.quit());
  const confirmation = lifecycle;
  await confirmation.waitForURL((url) => url.protocol === "pstdio:" && url.hostname === "lifecycle");
  expect(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  expect(
    await confirmation.evaluate(() => (globalThis as unknown as Window).promptStudioDesktop.getStartupState()),
  ).toMatchObject({ kind: "confirming_active_work" });
  await expect(confirmation.getByRole("button", { name: "Keep Prompt Studio open" })).toBeFocused();
  await acceptFocusedButton(confirmation);
  await expect(confirmation.getByRole("alertdialog")).toHaveCount(0);
  await expect(window.getByText("Owned Prompt Studio dashboard")).toBeVisible();
  await expect(window.getByRole("textbox", { name: "Draft" })).toHaveValue("Unsaved work");
  expect(shutdownForces).toEqual([false]);

  await electronApp.evaluate(({ app }) => app.quit());
  const nextConfirmation = lifecycle;
  await expect(nextConfirmation.getByRole("button", { name: "Keep Prompt Studio open" })).toBeFocused();
  expect(
    await nextConfirmation.evaluate(() => (globalThis as unknown as Window).promptStudioDesktop.getStartupState()),
  ).toMatchObject({ kind: "confirming_active_work" });
  await nextConfirmation.keyboard.press("Tab");
  await expect(nextConfirmation.getByRole("button", { name: "Cancel work and quit" })).toBeFocused();
  await nextConfirmation.keyboard.press("Enter").catch((error) => {
    if (!nextConfirmation.isClosed()) throw error;
  });
  await expect(lifecycle.getByRole("heading", { name: "Prompt Studio needs attention" })).toBeVisible();
  expect(nextConfirmation.isClosed()).toBe(false);
  expect(
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length),
  ).toBe(1);
  await lifecycle.getByRole("button", { name: "Quit", exact: true }).click();
  const finalConfirmation = lifecycle;
  await expect(finalConfirmation.getByRole("button", { name: "Keep Prompt Studio open" })).toBeFocused();
  expect(
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length),
  ).toBe(1);
  await finalConfirmation.keyboard.press("Tab");
  await expect(finalConfirmation.getByRole("button", { name: "Cancel work and quit" })).toBeFocused();
  await finishTrace();
  const closed = electronApp.waitForEvent("close");
  await acceptFocusedButton(finalConfirmation);
  await closed;

  expect(shutdownForces).toEqual([false, false, true, false, true]);
});
