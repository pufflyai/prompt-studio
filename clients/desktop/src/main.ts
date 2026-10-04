import { join } from "node:path";
import { app, autoUpdater, clipboard, dialog, ipcMain, Menu, protocol, shell } from "electron";
import { createLogger, resolveDefaultLogPath } from "pstdio-logging";
import { resolvePstdioRuntimeDescriptorPath } from "pstdio-paths";
import { createMacOSCliSetup } from "./cli/macos-cli-setup";
import { runWindowsInstallerEvent, windowsInstallerEvent } from "./cli/windows-installer";
import { formatDesktopDiagnostics } from "./diagnostics/diagnostics";
import { registerDesktopIpc } from "./ipc/register-desktop-ipc";
import {
  type DesktopState,
  initialDesktopState,
  type RuntimeActivity,
  transitionDesktopState,
} from "./lifecycle/lifecycle-machine";
import { recoveryError } from "./lifecycle/recovery-error";
import { startWorkbench } from "./lifecycle/start-workbench";
import { createApplicationMenuTemplate, setApplicationCommandsEnabled } from "./release/application-menu";
import { DesktopUpdateManager } from "./release/desktop-update-manager";
import { createDesktopUpdateNotifications } from "./release/desktop-update-notifications";
import { DesktopUpdateReceipt } from "./release/desktop-update-receipt";
import { DesktopRuntimeManager } from "./runtime/runtime-manager";
import { validateSidecarArtifact } from "./runtime/sidecar-artifact";
import { focusPrimaryWindow } from "./security/apply-window-security";
import { DesktopProjectTabsStore } from "./windows/desktop-project-tabs-store";
import { LIFECYCLE_SCHEME } from "./windows/lifecycle-protocol";
import { DesktopWindowController } from "./windows/window-controller";
import { DesktopWorkbenchStateStore } from "./windows/workbench-state-store";

const logger = createLogger({ component: "desktop", level: "info", service: "pstdio-desktop", sync: true });
const descriptorPath = resolvePstdioRuntimeDescriptorPath();
const externalRuntime = process.env.PSTDIO_DESKTOP_EXTERNAL_RUNTIME === "1";
const projectTabs = new DesktopProjectTabsStore(join(app.getPath("userData"), "project-tabs.json"));
const workbenchState = new DesktopWorkbenchStateStore(join(app.getPath("userData"), "workbench-state.json"));

protocol.registerSchemesAsPrivileged([
  {
    scheme: LIFECYCLE_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
  },
]);

let allowQuit = false;
let quitting = false;
let state: DesktopState = initialDesktopState;
let windowController: DesktopWindowController | null = null;
const updateNotifications = createDesktopUpdateNotifications({
  currentVersion: app.getVersion(),
  receipt: new DesktopUpdateReceipt(join(app.getPath("userData"), "downloaded-update-version")),
  showMessageBox: (options) => dialog.showMessageBox(options),
  logError: (error) => {
    logger.error({ event: "desktop.update.failed", message: error.message }, "Desktop update check failed");
  },
});
const updateManager = new DesktopUpdateManager({
  platform: process.platform,
  arch: process.arch,
  packaged: app.isPackaged,
  currentVersion: app.getVersion(),
  updater: autoUpdater,
  openExternal: (url) => shell.openExternal(url),
  onUpdateNotAvailable: updateNotifications.notAvailable,
  onUpdateDownloaded: updateNotifications.downloaded,
  onUpdateError: updateNotifications.failed,
});

const setState = (next: DesktopState) => {
  state = next;
  windowController?.updateState(next);
  setApplicationCommandsEnabled(Menu.getApplicationMenu(), next.kind === "workbench");
  logger.info({ event: "desktop.state.changed", state: next.kind }, "Desktop lifecycle state changed");
};

const runtimeManager = new DesktopRuntimeManager({
  descriptorPath,
  externalRuntime,
  resolveSidecarPath: (signal) =>
    validateSidecarArtifact({
      signal,
      resourcesPath: process.resourcesPath,
      platform: process.platform,
      arch: process.arch,
      appVersion: app.getVersion(),
    }),
  onPhase: (phase) => setState({ kind: "starting", phase }),
  onIntentionalShutdown: () => {
    setState({ kind: "closing" });
    void windowController?.showLifecycle();
    void runtimeManager.waitForExit().then(() => finishQuit());
  },
  onUnexpectedExit: (detail) => {
    // A crash also ends a pending quit confirmation; later quit requests must start over.
    quitting = false;
    setState({ kind: "recovery", error: recoveryError(new Error(detail)) });
    void windowController?.showLifecycle();
  },
});

const finishQuit = async () => {
  await projectTabs.flush();
  workbenchState.flush();
  allowQuit = true;
  app.quit();
};

const startRuntime = async () => {
  setState(initialDesktopState);
  try {
    const runtime = await startWorkbench(windowController!, runtimeManager);
    setState(
      transitionDesktopState(state, {
        type: "runtime_ready",
        runtime: {
          instanceId: runtime.descriptor.instanceId,
          origin: runtime.descriptor.origin,
          ownerType: runtime.descriptor.ownerType,
        },
      }),
    );
    if (app.isPackaged) updateNotifications.installed();
  } catch (error) {
    logger.error(
      { event: "desktop.runtime.start.failed", message: recoveryError(error).message },
      "Runtime start failed",
    );
    setState({ kind: "recovery", error: recoveryError(error) });
    // A quit requested during startup ends here too; later quit requests must start over.
    quitting = false;
    await windowController?.showLifecycle();
  }
};

const requestQuit = async () => {
  if (allowQuit) return;
  if (state.kind === "confirming_active_work") {
    await askToCancelActiveWork(state.activity);
    return;
  }
  if (quitting) return;
  quitting = true;
  const runtime = await runtimeManager.refreshRuntime();
  if (!runtime || runtime.external || runtime.descriptor.ownerType === "persistent") {
    runtimeManager.detach();
    finishQuit();
    return;
  }

  const result = await runtimeManager.requestShutdown(false);
  if (result.state === "active") {
    setState(
      transitionDesktopState(
        {
          kind: "workbench",
          runtime: {
            instanceId: runtime.descriptor.instanceId,
            origin: runtime.descriptor.origin,
            ownerType: runtime.descriptor.ownerType,
          },
        },
        { type: "quit_requested", activity: result.activity },
      ),
    );
    try {
      await windowController?.showQuitConfirmation(runtime.descriptor);
    } catch (error) {
      setState({ kind: "recovery", error: recoveryError(error) });
      await windowController?.showLifecycle();
      quitting = false;
    }
    return;
  }
  if (result.state === "accepted") {
    setState({ kind: "closing" });
  }

  if (result.state !== "accepted") {
    setState({ kind: "recovery", error: recoveryError(new Error("Runtime refused graceful shutdown")) });
    await windowController?.showLifecycle();
    quitting = false;
    return;
  }

  await windowController?.showLifecycle();
  await runtimeManager.waitForExit();
  finishQuit();
};

const cancelQuit = async () => {
  if (state.kind !== "confirming_active_work") return;
  setState(transitionDesktopState(state, { type: "quit_cancelled" }));
  quitting = false;
};

const confirmQuit = async () => {
  if (state.kind !== "confirming_active_work") return;
  setState(transitionDesktopState(state, { type: "quit_confirmed" }));
  await windowController?.showLifecycle();

  const result = await runtimeManager.requestShutdown(true);
  if (result.state !== "accepted") {
    setState({ kind: "recovery", error: recoveryError(new Error("Runtime refused graceful shutdown")) });
    quitting = false;
    return;
  }

  await runtimeManager.waitForExit();
  finishQuit();
};

// The dashboard shows the quit dialog. Asking to quit again means it may not be visible,
// for example when the dashboard failed to load, so ask with a native dialog that always shows.
const askToCancelActiveWork = async (activity: RuntimeActivity) => {
  const labels = [...activity.sessions, ...activity.terminals, ...activity.jobs].map((item) => item.label);
  const { response } = await dialog.showMessageBox({
    type: "warning",
    message: "Active work is still running",
    detail: `Canceling this work will stop: ${labels.join(", ")}. This cannot be undone.`,
    buttons: ["Keep Prompt Studio open", "Cancel work and quit"],
    defaultId: 0,
    cancelId: 0,
  });
  if (response === 1) await confirmQuit();
  else await cancelQuit();
};

const bootstrap = async () => {
  const cliSetup = createMacOSCliSetup((error) => {
    logger.error({ event: "desktop.cli.install.failed", message: error.message }, "CLI setup failed");
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      createApplicationMenuTemplate(
        process.platform,
        () => {
          void updateManager.checkForUpdates();
        },
        (commandId) => {
          if (state.kind === "workbench") windowController?.executeCommand(commandId);
        },
        cliSetup?.install,
      ),
    ),
  );
  const preloadPath = join(import.meta.dirname, "preload.cjs");
  windowController = await DesktopWindowController.create(preloadPath, () => workbenchState.getStartupAppearance());
  const { window } = windowController;
  window.once("show", () => {
    logger.info({ event: "desktop.window.ready", visible: window.isVisible() }, "Desktop startup window is ready");
  });
  windowController.window.on("close", (event) => {
    if (allowQuit) return;
    event.preventDefault();
    void requestQuit();
  });
  registerDesktopIpc({
    isFullScreen: () => window.isFullScreen(),
    setTitleBarAppearance: async (appearance) => {
      await windowController?.setTitleBarAppearance(appearance);
    },
    ipcMain,
    webContents: () => windowController?.webContents() ?? [],
    lifecycleUrl: windowController.lifecycleUrl,
    runtimeOrigin: () => windowController?.runtimeOrigin() ?? null,
    appInfo: () => ({ platform: process.platform, version: app.getVersion() }),
    cancelQuit,
    confirmQuit,
    getState: () => state,
    getStartupAppearance: () => workbenchState.getStartupAppearance(),
    setStartupAppearance: (value) => windowController?.setStartupAppearance(workbenchState.setStartupAppearance(value)),
    retryRuntime: startRuntime,
    openLogs: () => shell.showItemInFolder(resolveDefaultLogPath()),
    revealInFinder: (path) => {
      if (process.platform !== "darwin") throw new Error("Reveal in Finder is only available on macOS.");
      shell.showItemInFolder(path);
    },
    copyDiagnostics: () => {
      const runtime = runtimeManager.runtime?.descriptor;
      clipboard.writeText(
        formatDesktopDiagnostics(
          {
            appVersion: app.getVersion(),
            platform: process.platform,
            arch: process.arch,
            state: state.kind,
            runtimeOrigin: runtime?.origin,
            runtimePid: runtime?.pid,
            ownerType: runtime?.ownerType,
            logPath: resolveDefaultLogPath(),
            detail: runtimeManager.diagnosticsDetail(),
          },
          runtime ? [runtime.token] : [],
        ),
      );
    },
    checkForUpdates: () => updateManager.checkForUpdates(),
    quitApp: requestQuit,
    getWorkbenchState: () => workbenchState.getState(),
    getProjectTabs: () => projectTabs.getProjectTabs(),
    setProjectTabs: (value) => projectTabs.setProjectTabs(value),
    setWorkbenchItem: (key, value) => workbenchState.setItem(key, value),
  });
  await startRuntime();
  void cliSetup?.onFirstLaunch();
};

const installerEvent = app.isPackaged ? windowsInstallerEvent(process.platform, process.argv) : null;
if (installerEvent) {
  void runWindowsInstallerEvent(installerEvent, process.execPath, process.resourcesPath).then(
    () => app.exit(0),
    (error) => {
      logger.error({ event: "desktop.install.failed", message: String(error) }, "Desktop installation failed");
      app.exit(1);
    },
  );
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  if (process.platform === "win32") app.setAppUserModelId("com.squirrel.PromptStudio.PromptStudio");
  app.on("second-instance", () => focusPrimaryWindow(windowController?.window ?? null));
  // Closing the window flushes the renderer's last layout writes after finishQuit.
  app.on("will-quit", () => workbenchState.flush());
  app.on("before-quit", (event) => {
    if (allowQuit) return;
    event.preventDefault();
    void requestQuit();
  });
  app.on("activate", () => focusPrimaryWindow(windowController?.window ?? null));
  void app.whenReady().then(bootstrap);
}
