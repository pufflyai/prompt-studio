import { join } from "node:path";
import { app, clipboard, dialog, ipcMain, Menu, protocol, shell } from "electron";
import { createLogger, resolveDefaultLogPath } from "pstdio-logging";
import { resolvePstdioRuntimeDescriptorPath } from "pstdio-paths";
import { createMacOSCliSetup } from "./cli/macos-cli-setup";
import { runWindowsInstallerEvent, windowsInstallerEvent } from "./cli/windows-installer";
import { formatDesktopDiagnostics } from "./diagnostics/diagnostics";
import { workbenchErrorDetails } from "./diagnostics/workbench-error";
import { registerDesktopIpc } from "./ipc/register-desktop-ipc";
import { createDeviceFileSaver } from "./ipc/save-device-file";
import {
  type DesktopRecoveryError,
  type DesktopState,
  initialDesktopState,
  transitionDesktopState,
} from "./lifecycle/lifecycle-machine";
import { askToCancelActiveWork, showNativeRecovery } from "./lifecycle/native-recovery";
import { createQuitFlow } from "./lifecycle/quit-flow";
import { recoveryError } from "./lifecycle/recovery-error";
import { createRecoveryPresentation } from "./lifecycle/recovery-presentation";
import { createRuntimeRecovery } from "./lifecycle/runtime-recovery";
import { startWorkbench } from "./lifecycle/start-workbench";
import { createDesktopPerformanceMonitor } from "./performance/create-desktop-performance-monitor";
import { createApplicationMenuTemplate, setApplicationCommandsEnabled } from "./release/application-menu";
import { createDesktopUpdates } from "./release/desktop-updates";
import { DesktopRuntimeManager } from "./runtime/runtime-manager";
import { validateSidecarArtifact } from "./runtime/sidecar-artifact";
import { focusPrimaryWindow } from "./security/apply-window-security";
import { DesktopProjectTabsStore } from "./windows/desktop-project-tabs-store";
import { LIFECYCLE_SCHEME } from "./windows/lifecycle-protocol";
import { DesktopWindowController, type WorkbenchLoadFailure } from "./windows/window-controller";
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
  backend: () => {
    const descriptor = runtimeManager.runtime?.descriptor;
    const identity = runtimeManager.processIdentity;
    if (!identity) return null;
    return {
      id: identity.instanceId,
      pid: identity.pid,
      origin: descriptor?.origin ?? null,
      token: descriptor?.token ?? null,
      scope: "local",
    };
  },
  logEndpointFailure: (error) => {
    logger.warn(
      { event: "desktop.performance.endpoint.failed", message: String(error) },
      "Performance endpoint failed",
    );
  },
});
const desktopUpdates = createDesktopUpdates(logger, () => windowController?.notifyUpdate());

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
    // Once desktop has requested shutdown, its quit flow owns when the window closes.
    if (quitFlow.isQuitting()) return;
    setState({ kind: "closing" });
    void windowController?.showLifecycle().catch((error) => {
      logger.warn({ event: "desktop.closing.unavailable", message: String(error) }, "Closing interface unavailable");
    });
    void runtimeManager.waitForExit().then(() => quitFlow.finishQuit());
  },
  onUnexpectedExit: (detail) => {
    if (quitFlow.isQuitting() || state.kind === "closing" || state.kind === "detached") return;
    void runtimeRecovery.recover(new Error(detail));
  },
});

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
  quitApp: (intent) => {
    if (intent !== "install-update") {
      app.quit();
      return;
    }
    desktopUpdates.install();
  },
  recoveryError,
  logError: (error) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ event: "desktop.quit.failed", message }, "Desktop quit failed");
  },
});

const presentRecovery = createRecoveryPresentation({
  showLifecycle: () => windowController!.showLifecycle(),
  showNative: showNativeRecovery,
  openLogs: () => shell.showItemInFolder(resolveDefaultLogPath()),
  retry: () => {
    void runtimeRecovery.start();
  },
  quit: () => quitFlow.requestQuit(),
  isQuitting: () => quitFlow.isQuitting() || state.kind === "closing" || state.kind === "detached",
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
    desktopUpdates.notifyInstalled();
  },
  showFailure: async (error) => {
    if (quitFlow.isQuitting() || state.kind === "closing" || state.kind === "detached") return;
    logger.error(
      { event: "desktop.runtime.start.failed", message: recoveryError(error).message },
      "Runtime start failed",
    );
    setState({ kind: "recovery", error: recoveryError(error) });
    await presentRecovery(recoveryError(error));
  },
});

const showWorkbenchRecovery = (failure: WorkbenchLoadFailure) => {
  if (state.kind !== "workbench" && state.kind !== "confirming_active_work") return;
  logger.error({ event: "desktop.workbench.unavailable", ...failure }, "Workbench renderer unavailable");
  const error: DesktopRecoveryError = {
    code: "workbench_unavailable",
    message: "The workbench stopped. Retry to reopen it.",
    actions: ["retry", "open_logs", "quit"],
  };
  setState({ kind: "recovery", error });
  void presentRecovery(error).catch(() => {
    logger.error({ event: "desktop.workbench.recovery.failed" }, "Could not show workbench recovery");
  });
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
          void desktopUpdates.check();
        },
        (commandId) => {
          if (state.kind === "workbench") windowController?.executeCommand(commandId);
        },
        cliSetup?.install,
      ),
    ),
  );
  const preloadPath = join(import.meta.dirname, "preload.cjs");
  windowController = await DesktopWindowController.create(
    preloadPath,
    () => workbenchState.getStartupAppearance(),
    showWorkbenchRecovery,
  );
  const { window } = windowController;
  windowController.window.on("close", (event) => {
    if (quitFlow.isQuitAllowed()) return;
    event.preventDefault();
    void quitFlow.requestQuit();
  });
  registerDesktopIpc({
    saveFile: createDeviceFileSaver((options) => dialog.showSaveDialog(window, options)),
    titleBarGeometrySource: window.webContents,
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
            startupPhase: state.kind === "starting" ? state.phase : undefined,
            startupError: state.kind === "recovery" ? state.error.code : undefined,
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
    checkForUpdates: desktopUpdates.check,
    takeUpdateNotice: desktopUpdates.takeNotice,
    restartToInstallUpdate: async () => {
      if (state.kind === "workbench" && desktopUpdates.canInstall()) await quitFlow.requestUpgrade();
    },
    updateChannel: desktopUpdates.channel,
    quitApp: quitFlow.requestQuit,
    getWorkbenchState: () => workbenchState.getState(),
    getProjectTabs: () => projectTabs.getProjectTabs(),
    setProjectTabs: async (value) => {
      const { projectIds } = await projectTabs.setProjectTabs(value);
      // Offer the pst command once the person has a project, so the first launch asks for nothing.
      if (projectIds.length > 0) void cliSetup?.offerOnce();
    },
    setWorkbenchItem: (key, value) => workbenchState.setItem(key, value),
    reportWorkbenchError: (report) => {
      const token = runtimeManager.lastDescriptor?.token;
      const details = workbenchErrorDetails(report, token ? [token] : []);
      if (!details) return;
      logger.error(details, "Workbench render failed");
      if (!details.projectId) {
        windowController?.markWorkbenchFailed();
        const error = new Error("workbench_unavailable: The workbench could not open. Retry to reopen it.");
        const aborted = windowController?.abortWorkbenchStartup(error);
        if (state.kind === "starting") {
          // Startup can preserve a more specific runtime failure before revealing recovery.
          if (!aborted) void runtimeRecovery.recover(error);
        } else {
          // A failed dashboard has recovery actions in the lifecycle window, even when it was loading for Quit.
          showWorkbenchRecovery({ reason: "render_failed" });
        }
      }
    },
    performance: performanceMonitor,
  });
  void performanceMonitor.start();
  await runtimeRecovery.start();
  desktopUpdates.startBackgroundChecks();
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
