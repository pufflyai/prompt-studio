import { join } from "node:path";
import { app, autoUpdater, clipboard, ipcMain, Menu, protocol, shell } from "electron";
import electronSquirrelStartup from "electron-squirrel-startup";
import { createLogger, resolveDefaultLogPath } from "pstdio-logging";
import { resolvePstdioRuntimeDescriptorPath } from "pstdio-paths";
import { formatDesktopDiagnostics } from "./diagnostics/diagnostics";
import { registerDesktopIpc } from "./ipc/register-desktop-ipc";
import {
  type DesktopRecoveryError,
  type DesktopState,
  initialDesktopState,
  transitionDesktopState,
} from "./lifecycle/lifecycle-machine";
import { createApplicationMenuTemplate, setApplicationCommandsEnabled } from "./release/application-menu";
import { DesktopUpdateManager } from "./release/desktop-update-manager";
import { DesktopRuntimeManager } from "./runtime/runtime-manager";
import { DesktopSidecarError, validateSidecarArtifact } from "./runtime/sidecar-artifact";
import { focusPrimaryWindow } from "./security/apply-window-security";
import { DesktopProjectTabsStore } from "./windows/desktop-project-tabs-store";
import { LIFECYCLE_SCHEME } from "./windows/lifecycle-protocol";
import { DesktopWindowController } from "./windows/window-controller";
import { DesktopWorkbenchStateStore } from "./windows/workbench-state-store";

const logger = createLogger({ component: "desktop", level: "info", service: "pstdio-desktop", sync: true });
const descriptorPath = resolvePstdioRuntimeDescriptorPath();
const externalRuntime = process.env.PSTDIO_DESKTOP_EXTERNAL_RUNTIME === "1";
const projectTabs = new DesktopProjectTabsStore(join(app.getPath("userData"), "project-tabs.json"));

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
const updateManager = new DesktopUpdateManager({
  platform: process.platform,
  arch: process.arch,
  packaged: app.isPackaged,
  updater: autoUpdater,
  openExternal: (url) => shell.openExternal(url),
});
const reportUpdateError = (error: Error) => {
  logger.error({ event: "desktop.update.failed", message: error.message }, "Desktop update check failed");
};
autoUpdater.on("error", reportUpdateError);

const setState = (next: DesktopState) => {
  state = next;
  windowController?.updateState(next);
  setApplicationCommandsEnabled(Menu.getApplicationMenu(), next.kind === "workbench");
  logger.info({ event: "desktop.state.changed", state: next.kind }, "Desktop lifecycle state changed");
};

const recoveryCode = (detail: string): DesktopRecoveryError["code"] => {
  if (detail.startsWith("port_bind_failure:")) return "port_bind_failure";
  if (detail.startsWith("pglite_ownership_conflict:")) return "pglite_ownership_conflict";
  if (detail.startsWith("pglite_recovery_failure:")) return "pglite_recovery_failure";
  if (detail.includes("timed out")) return "runtime_timeout";
  return "unexpected_exit";
};

const recoveryError = (error: unknown): DesktopRecoveryError => {
  if (error instanceof DesktopSidecarError) {
    return {
      code: error.code === "missing_sidecar" ? "sidecar_missing" : error.code,
      message: error.message.slice(error.message.indexOf(": ") + 2),
      actions: ["open_logs", "copy_diagnostics", "quit"],
    };
  }
  const detail = error instanceof Error ? error.message : String(error);
  if (detail.includes("sidecar is missing")) {
    return {
      code: "sidecar_missing",
      message: "The packaged Prompt Studio runtime could not be found.",
      actions: ["open_logs", "copy_diagnostics", "quit"],
    };
  }
  if (detail.includes("invalid_descriptor") || detail.includes("ownership is unsafe")) {
    return {
      code: "runtime_ownership_uncertain",
      message: "Prompt Studio found a runtime whose ownership could not be verified safely.",
      actions: ["retry", "open_logs", "copy_diagnostics", "quit"],
    };
  }
  return {
    code: recoveryCode(detail),
    message: detail.includes(": ")
      ? detail.slice(detail.indexOf(": ") + 2)
      : "Prompt Studio could not start its runtime.",
    actions: ["retry", "open_logs", "copy_diagnostics", "quit"],
  };
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
    setState({ kind: "recovery", error: recoveryError(new Error(detail)) });
    void windowController?.showLifecycle();
  },
});

const finishQuit = async () => {
  await projectTabs.flush();
  allowQuit = true;
  app.quit();
};

const startRuntime = async () => {
  setState(initialDesktopState);
  const lifecycleReady = windowController?.showLifecycle();
  try {
    const runtime = await runtimeManager.start();
    await Promise.all([windowController?.showWorkbench(runtime.descriptor), lifecycleReady]);
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
  } catch (error) {
    await lifecycleReady;
    logger.error(
      { event: "desktop.runtime.start.failed", message: recoveryError(error).message },
      "Runtime start failed",
    );
    setState({ kind: "recovery", error: recoveryError(error) });
    await windowController?.showLifecycle();
  }
};

const requestQuit = async () => {
  if (quitting || allowQuit) return;
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
    await windowController?.showQuitConfirmation();
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
  windowController?.dismissQuitConfirmation();
};

const confirmQuit = async () => {
  if (state.kind !== "confirming_active_work") return;
  setState(transitionDesktopState(state, { type: "quit_confirmed" }));

  const result = await runtimeManager.requestShutdown(true);
  if (result.state !== "accepted") {
    setState({ kind: "recovery", error: recoveryError(new Error("Runtime refused graceful shutdown")) });
    await windowController?.showLifecycle();
    quitting = false;
    return;
  }

  await runtimeManager.waitForExit();
  finishQuit();
};

const bootstrap = async () => {
  const workbenchState = new DesktopWorkbenchStateStore(join(app.getPath("userData"), "workbench-state.json"));
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      createApplicationMenuTemplate(
        process.platform,
        () => {
          void updateManager.checkForUpdates().catch(reportUpdateError);
        },
        (commandId) => {
          if (state.kind === "workbench") windowController?.executeCommand(commandId);
        },
      ),
    ),
  );
  const preloadPath = join(import.meta.dirname, "preload.cjs");
  windowController = await DesktopWindowController.create(preloadPath);
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
    setPageLocation: (projectId, value) => workbenchState.setPageLocation(projectId, value),
    setSelectedProjectId: (projectId) => workbenchState.setSelectedProjectId(projectId),
  });
  await startRuntime();
};

if (electronSquirrelStartup) {
  app.quit();
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  if (process.platform === "win32") app.setAppUserModelId("com.squirrel.PromptStudio.PromptStudio");
  app.on("second-instance", () => focusPrimaryWindow(windowController?.window ?? null));
  app.on("before-quit", (event) => {
    if (allowQuit) return;
    event.preventDefault();
    void requestQuit();
  });
  app.on("activate", () => focusPrimaryWindow(windowController?.window ?? null));
  void app.whenReady().then(bootstrap);
}
