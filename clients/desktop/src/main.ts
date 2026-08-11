import { join } from "node:path";
import { app, clipboard, dialog, ipcMain, protocol, shell } from "electron";
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
import { DesktopRuntimeManager } from "./runtime/runtime-manager";
import { DesktopSidecarError, validateSidecarArtifact } from "./runtime/sidecar-artifact";
import { focusPrimaryWindow } from "./security/apply-window-security";
import { LIFECYCLE_SCHEME } from "./windows/lifecycle-protocol";
import { DesktopWindowController } from "./windows/window-controller";

const logger = createLogger({ component: "desktop", level: "info", service: "pstdio-desktop", sync: true });
const descriptorPath = resolvePstdioRuntimeDescriptorPath();
const externalRuntime = process.env.PSTDIO_DESKTOP_EXTERNAL_RUNTIME === "1";

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
const setState = (next: DesktopState) => {
  state = next;
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
  resolveSidecarPath: () =>
    validateSidecarArtifact({
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

const finishQuit = () => {
  allowQuit = true;
  app.quit();
};

const startRuntime = async () => {
  setState(initialDesktopState);
  await windowController?.showLifecycle();
  try {
    const runtime = await runtimeManager.start();
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
    await windowController?.showWorkbench(runtime.descriptor);
  } catch (error) {
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

  let result = await runtimeManager.requestShutdown(false);
  if (result.state === "active") {
    setState(
      transitionDesktopState(state, {
        type: "quit_requested",
        activity: result.activity,
      }),
    );
    const response = await dialog.showMessageBox(windowController!.window, {
      type: "warning",
      title: "Active work is still running",
      message: "Quit Prompt Studio and cancel active work?",
      detail: `${result.activity.sessions.length} sessions, ${result.activity.terminals.length} terminals, and ${result.activity.jobs.length} jobs are active.`,
      buttons: ["Keep Prompt Studio open", "Cancel work and quit"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (response.response === 0) {
      setState(transitionDesktopState(state, { type: "quit_cancelled" }));
      quitting = false;
      return;
    }
    setState(transitionDesktopState(state, { type: "quit_confirmed" }));
    result = await runtimeManager.requestShutdown(true);
  } else if (result.state === "accepted") {
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

const bootstrap = async () => {
  const preloadPath = join(import.meta.dirname, "preload.cjs");
  windowController = await DesktopWindowController.create(preloadPath);
  windowController.window.on("close", (event) => {
    if (allowQuit) return;
    event.preventDefault();
    void requestQuit();
  });
  registerDesktopIpc({
    ipcMain,
    window: windowController.window,
    lifecycleUrl: windowController.lifecycleUrl,
    runtimeOrigin: () => windowController?.runtimeOrigin() ?? null,
    appInfo: () => ({ platform: process.platform, version: app.getVersion() }),
    getState: () => state,
    retryRuntime: startRuntime,
    openLogs: () => shell.showItemInFolder(resolveDefaultLogPath()),
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
    quitApp: requestQuit,
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
