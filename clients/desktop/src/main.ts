import { join } from "node:path";
import { app, autoUpdater, clipboard, dialog, ipcMain, Menu, protocol, shell } from "electron";
import { createLogger, resolveDefaultLogPath } from "pstdio-logging";
import { resolvePstdioRuntimeDescriptorPath, resolvePstdioUpdateChannelPath } from "pstdio-paths";
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
import { createQuitFlow } from "./lifecycle/quit-flow";
import { recoveryError } from "./lifecycle/recovery-error";
import { createRuntimeRecovery } from "./lifecycle/runtime-recovery";
import { startWorkbench } from "./lifecycle/start-workbench";
import { createDesktopPerformanceMonitor } from "./performance/create-desktop-performance-monitor";
import { createApplicationMenuTemplate, setApplicationCommandsEnabled } from "./release/application-menu";
import { createDesktopUpdateChannel } from "./release/desktop-update-channel";
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

let state: DesktopState = initialDesktopState;
let windowController: DesktopWindowController | null = null;
const performanceMonitor = createDesktopPerformanceMonitor({
  windows: () => windowController,
  logEndpointFailure: (error) => {
    logger.warn(
      { event: "desktop.performance.endpoint.failed", message: String(error) },
      "Performance endpoint failed",
    );
  },
});
const updateNotifications = createDesktopUpdateNotifications({
  currentVersion: app.getVersion(),
  receipt: new DesktopUpdateReceipt(join(app.getPath("userData"), "downloaded-update-version")),
  showMessageBox: (options) => dialog.showMessageBox(options),
  logError: (error) => {
    logger.error({ event: "desktop.update.failed", message: error.message }, "Desktop update check failed");
  },
});
// The file lives in the Prompt Studio home so `pst update-channel` can change it too.
const updateChannel = createDesktopUpdateChannel({
  path: resolvePstdioUpdateChannelPath(),
  platform: process.platform,
  packaged: app.isPackaged,
});
const updateManager = new DesktopUpdateManager({
  platform: process.platform,
  arch: process.arch,
  packaged: app.isPackaged,
  currentVersion: app.getVersion(),
  channel: updateChannel.current,
  updater: autoUpdater,
  openExternal: (url) => shell.openExternal(url),
  onUpdateNotAvailable: updateNotifications.notAvailable,
  onUpdateDownloaded: updateNotifications.downloaded,
  onUpdateError: updateNotifications.failed,
  logError: (error) => {
    logger.warn(
      { event: "desktop.update.background.failed", message: error.message },
      "Background update check failed",
    );
  },
});
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

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
    void runtimeManager.waitForExit().then(() => quitFlow.finishQuit());
  },
  onUnexpectedExit: (detail) => {
    if (quitFlow.isQuitting() || state.kind === "closing" || state.kind === "detached") return;
    void runtimeRecovery.recover(new Error(detail));
  },
});

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
  return response === 1;
};

const quitFlow = createQuitFlow({
  runtimeManager,
  getState: () => state,
  setState,
  showLifecycle: async () => {
    await windowController?.showLifecycle();
  },
  showQuitConfirmation: async (descriptor) => {
    await windowController?.showQuitConfirmation(descriptor);
  },
  askToCancelActiveWork,
  flushBeforeQuit: async () => {
    await Promise.all([projectTabs.flush(), performanceMonitor.stop()]);
    workbenchState.flush();
  },
  quitApp: () => app.quit(),
  recoveryError,
  logError: (error) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ event: "desktop.quit.failed", message }, "Desktop quit failed");
  },
});

const runtimeRecovery = createRuntimeRecovery({
  canRestart: () => !externalRuntime && !quitFlow.isQuitting() && state.kind === "workbench",
  start: async () => {
    setState(initialDesktopState);
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
  },
  showFailure: async (error) => {
    if (quitFlow.isQuitting() || state.kind === "closing" || state.kind === "detached") return;
    logger.error(
      { event: "desktop.runtime.start.failed", message: recoveryError(error).message },
      "Runtime start failed",
    );
    setState({ kind: "recovery", error: recoveryError(error) });
    await windowController?.showLifecycle();
  },
});

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
    if (quitFlow.isQuitAllowed()) return;
    event.preventDefault();
    void quitFlow.requestQuit();
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
    cancelQuit: quitFlow.cancelQuit,
    confirmQuit: quitFlow.confirmQuit,
    getState: () => state,
    getStartupAppearance: () => workbenchState.getStartupAppearance(),
    setStartupAppearance: (value) => windowController?.setStartupAppearance(workbenchState.setStartupAppearance(value)),
    retryRuntime: () => (quitFlow.isQuitting() ? Promise.resolve() : runtimeRecovery.start()),
    openLogs: () => shell.showItemInFolder(resolveDefaultLogPath()),
    revealInFinder: (path) => {
      if (process.platform !== "darwin") throw new Error("Reveal in Finder is only available on macOS.");
      shell.showItemInFolder(path);
    },
    copyDiagnostics: () => {
      const runtime = runtimeManager.lastDescriptor;
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
    updateChannel: {
      choice: updateChannel.choice,
      set: (channel) => {
        updateChannel.set(channel);
        // Start downloading right away so a switch to nightly does not wait hours.
        void updateManager.checkInBackground();
      },
    },
    quitApp: quitFlow.requestQuit,
    getWorkbenchState: () => workbenchState.getState(),
    getProjectTabs: () => projectTabs.getProjectTabs(),
    setProjectTabs: async (value) => {
      const { projectIds } = await projectTabs.setProjectTabs(value);
      // Offer the pst command once the person has a project, so the first launch asks for nothing.
      if (projectIds.length > 0) void cliSetup?.offerOnce();
    },
    setWorkbenchItem: (key, value) => workbenchState.setItem(key, value),
    performance: performanceMonitor,
  });
  void performanceMonitor.start();
  await runtimeRecovery.start();
  // Squirrel.Windows still holds its update lock on first run, so wait for the interval.
  if (!process.argv.includes("--squirrel-firstrun")) void updateManager.checkInBackground();
  setInterval(() => void updateManager.checkInBackground(), UPDATE_CHECK_INTERVAL_MS);
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
    if (quitFlow.isQuitAllowed()) return;
    event.preventDefault();
    void quitFlow.requestQuit();
  });
  app.on("activate", () => focusPrimaryWindow(windowController?.window ?? null));
  void app.whenReady().then(bootstrap);
}
