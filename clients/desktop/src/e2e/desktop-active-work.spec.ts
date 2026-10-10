import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { _electron as electron, expect, type Page, test } from "@playwright/test";
import { startActiveRuntime } from "./active-runtime-fixture";
import { waitForLifecyclePage, waitForWorkbenchPage } from "./desktop-pages";
import { startElectronTrace } from "./electron-trace";
import { expectStartupWindowVisible } from "./startup-window";

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

const launchDesktop = async (home: string, traceName: string) => {
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [appPath, `--user-data-dir=${join(home, "electron-user-data")}`],
    env: environment({ PSTDIO_HOME: home }),
  });
  const finishTrace = await startElectronTrace(electronApp.context(), traceName);
  cleanup.push(async () => {
    await finishTrace();
    await electronApp.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await electronApp.close().catch(() => {});
  });
  return { electronApp, finishTrace };
};

test.afterEach(async () => {
  for (const action of cleanup.reverse()) await action();
  cleanup.length = 0;
});

test("shows each quit confirmation over the workbench and recovers from refused shutdown", async () => {
  const { home, descriptor, shutdownForces } = await startActiveRuntime(cleanup, {
    refuseFirstForcedShutdown: true,
    holdDashboard: false,
  });
  const { electronApp, finishTrace } = await launchDesktop(home, "active-work");

  const lifecycle = await waitForLifecyclePage(electronApp.context());
  await expectStartupWindowVisible(electronApp, lifecycle);
  const window = await waitForWorkbenchPage(lifecycle, descriptor.origin);
  await expect(window.getByText("Owned Prompt Studio dashboard")).toBeVisible();

  // Occluded lifecycle renderers may stop receiving animation frames.
  await lifecycle.addInitScript(() => {
    globalThis.requestAnimationFrame = () => 0;
  });
  await lifecycle.reload();

  const desktopState = () =>
    window.evaluate(() => (globalThis as unknown as Window).promptStudioDesktop.getStartupState());
  const workbenchVisible = () =>
    electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children[0].getVisible());
  // The dashboard renders the quit dialog from the state the workbench receives.
  const expectConfirmationInWorkbench = async () => {
    await expect.poll(desktopState).toMatchObject({ kind: "confirming_active_work" });
    expect(await workbenchVisible()).toBe(true);
    await expect(lifecycle.getByRole("main")).toHaveCount(0);
  };
  await window.evaluate(() => {
    const target = globalThis as unknown as Window & { receivedStates: string[] };
    target.receivedStates = [];
    target.promptStudioDesktop.onStartupState((state) => target.receivedStates.push(state.kind));
  });

  await window.getByRole("textbox", { name: "Draft" }).fill("Unsaved work");
  await electronApp.evaluate(({ app }) => app.quit());
  await expectConfirmationInWorkbench();
  expect(await window.evaluate(() => (globalThis as unknown as { receivedStates: string[] }).receivedStates)).toContain(
    "confirming_active_work",
  );
  expect(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  await window.evaluate(() => (globalThis as unknown as Window).promptStudioDesktop.cancelQuit());
  await expect.poll(desktopState).toMatchObject({ kind: "workbench" });
  await expect(window.getByRole("textbox", { name: "Draft" })).toHaveValue("Unsaved work");
  expect(shutdownForces).toEqual([false]);

  await electronApp.evaluate(({ app }) => app.quit());
  await expectConfirmationInWorkbench();
  void window.evaluate(() => (globalThis as unknown as Window).promptStudioDesktop.confirmQuit());
  await expect(lifecycle.getByRole("heading", { name: "Prompt Studio needs attention" })).toBeVisible();
  expect(await workbenchVisible()).toBe(false);
  expect(
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length),
  ).toBe(1);

  await lifecycle.getByRole("button", { name: "Quit", exact: true }).click();
  await expectConfirmationInWorkbench();
  await window.evaluate(() => (globalThis as unknown as Window).promptStudioDesktop.cancelQuit());
  await expect.poll(desktopState).toMatchObject({ kind: "workbench" });

  // A crashed workbench loads again so its dialog can appear instead of stalling the quit.
  // Playwright cannot drive a page after its renderer crashes, so read the new page from main.
  const workbenchContents = (script: string) =>
    electronApp.evaluate(
      ({ webContents }, [origin, source]) => {
        const contents = webContents.getAllWebContents().find((candidate) => candidate.getURL().startsWith(origin));
        if (!contents || contents.isCrashed() || contents.isLoading()) return null;
        return contents.executeJavaScript(source);
      },
      [descriptor.origin, script] as const,
    );
  await electronApp.evaluate(async ({ webContents }, origin) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.getURL().startsWith(origin)) continue;
      // Crashing the process is asynchronous; quit must see the completed crash.
      await new Promise<void>((resolve) => {
        contents.once("render-process-gone", () => resolve());
        contents.forcefullyCrashRenderer();
      });
    }
  }, descriptor.origin);
  await electronApp.evaluate(({ app }) => app.quit());
  await expect
    .poll(() => workbenchContents("promptStudioDesktop.getStartupState().then((state) => state.kind)"))
    .toBe("confirming_active_work");
  expect(await workbenchContents("document.body.innerText")).toContain("Owned Prompt Studio dashboard");
  expect(await workbenchVisible()).toBe(true);
  await expect(lifecycle.getByRole("main")).toHaveCount(0);
  expect(
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length),
  ).toBe(1);

  await finishTrace();
  const closed = electronApp.waitForEvent("close");
  void workbenchContents("promptStudioDesktop.confirmQuit()").catch(() => {});
  await closed;

  expect(shutdownForces).toEqual([false, false, true, false, false, true]);
});

const startupState = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as Window).promptStudioDesktop.getStartupState());

test("keeps the first workbench load when a quit arrives while it loads", async () => {
  const runtime = await startActiveRuntime(cleanup, { refuseFirstForcedShutdown: false, holdDashboard: true });
  const { electronApp } = await launchDesktop(runtime.home, "active-work-loading");
  const lifecycle = await waitForLifecyclePage(electronApp.context());
  await runtime.dashboardRequested;

  await electronApp.evaluate(({ app }) => app.quit());
  await expect.poll(() => startupState(lifecycle)).toMatchObject({ kind: "confirming_active_work" });
  runtime.releaseDashboard();
  const window = await waitForWorkbenchPage(lifecycle, runtime.descriptor.origin);

  await expect(window.getByText("Owned Prompt Studio dashboard")).toBeVisible();
  await expect.poll(() => startupState(window)).toMatchObject({ kind: "confirming_active_work" });
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].contentView.children[0].getVisible(),
    ),
  ).toBe(true);
  await window.evaluate(() => (globalThis as unknown as Window).promptStudioDesktop.cancelQuit());
  await expect.poll(() => startupState(window)).toMatchObject({ kind: "workbench" });
  expect(runtime.shutdownForces).toEqual([false]);
});

test("asks with a native dialog when the person quits again during confirmation", async () => {
  const runtime = await startActiveRuntime(cleanup, { refuseFirstForcedShutdown: false, holdDashboard: false });
  const { electronApp, finishTrace } = await launchDesktop(runtime.home, "active-work-native");
  const lifecycle = await waitForLifecyclePage(electronApp.context());
  const window = await waitForWorkbenchPage(lifecycle, runtime.descriptor.origin);
  await expect(window.getByText("Owned Prompt Studio dashboard")).toBeVisible();
  await electronApp.evaluate(({ dialog }) => {
    const target = globalThis as typeof globalThis & { messageBoxes: string[]; nextResponse: number };
    target.messageBoxes = [];
    target.nextResponse = 0;
    dialog.showMessageBox = (async (...args: unknown[]) => {
      target.messageBoxes.push((args.at(-1) as { message: string }).message);
      return { response: target.nextResponse, checkboxChecked: false };
    }) as typeof dialog.showMessageBox;
  });
  const messageBoxes = () =>
    electronApp.evaluate(() => (globalThis as typeof globalThis & { messageBoxes: string[] }).messageBoxes);

  // This test dashboard renders no quit dialog, like a dashboard that failed to load.
  await electronApp.evaluate(({ app }) => app.quit());
  await expect.poll(() => startupState(window)).toMatchObject({ kind: "confirming_active_work" });
  await electronApp.evaluate(({ app }) => app.quit());
  await expect.poll(() => startupState(window)).toMatchObject({ kind: "workbench" });
  expect(await messageBoxes()).toEqual(["Active work is still running"]);

  await electronApp.evaluate(({ app }) => app.quit());
  await expect.poll(() => startupState(window)).toMatchObject({ kind: "confirming_active_work" });
  await electronApp.evaluate(() => {
    (globalThis as typeof globalThis & { nextResponse: number }).nextResponse = 1;
  });
  await finishTrace();
  const closed = electronApp.waitForEvent("close");
  await electronApp.evaluate(({ app }) => app.quit()).catch(() => {});
  await closed;
  expect(runtime.shutdownForces).toEqual([false, false, true]);
});
