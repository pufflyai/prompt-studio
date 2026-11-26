import { join } from "node:path";
import { app, autoUpdater, dialog, shell } from "electron";
import type { createLogger } from "pstdio-logging";
import { resolvePstdioUpdateChannelPath } from "pstdio-paths";
import { createDesktopUpdateChannel } from "./desktop-update-channel";
import { DesktopUpdateManager } from "./desktop-update-manager";
import { createDesktopUpdateNotifications } from "./desktop-update-notifications";
import { DesktopUpdateReceipt } from "./desktop-update-receipt";
import { installDesktopUpdate } from "./install-desktop-update";

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

export const createDesktopUpdates = (logger: ReturnType<typeof createLogger>, onNotice: () => void) => {
  const updateNotifications = createDesktopUpdateNotifications({
    currentVersion: app.getVersion(),
    receipt: new DesktopUpdateReceipt(join(app.getPath("userData"), "downloaded-update-version")),
    onNotice,
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
    onUpdateProgress: updateNotifications.progress,
    onUpgradeChanged: updateNotifications.upgradeChanged,
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

  return {
    check: () => updateManager.checkForUpdates(),
    takeNotice: () => updateNotifications.take(updateManager.upgrade),
    canInstall: () => updateManager.upgrade?.ready ?? false,
    notifyInstalled: () => {
      if (app.isPackaged) updateNotifications.installed();
    },
    channel: {
      choice: updateChannel.choice,
      set: (channel: Parameters<typeof updateChannel.set>[0]) => {
        updateChannel.set(channel);
        void updateManager.checkInBackground();
      },
    },
    startBackgroundChecks: () => {
      // Squirrel.Windows still holds its update lock on first run.
      if (!process.argv.includes("--squirrel-firstrun")) void updateManager.checkInBackground();
      setInterval(() => void updateManager.checkInBackground(), UPDATE_CHECK_INTERVAL_MS);
    },
    install: () => {
      // Let Squirrel finish the macOS relaunch after Electron closes the last window.
      const waitForInstaller = () => {};
      if (process.platform === "darwin") app.once("window-all-closed", waitForInstaller);
      installDesktopUpdate(autoUpdater, (error) => {
        app.removeListener("window-all-closed", waitForInstaller);
        logger.error({ event: "desktop.update.install.failed", message: error.message }, "Desktop upgrade failed");
        void dialog
          .showMessageBox({
            type: "error",
            message: "Prompt Studio couldn’t install the upgrade.",
            detail:
              "Reopen Prompt Studio to continue working. You can check for updates again from the application menu.",
            buttons: ["Reopen Prompt Studio"],
          })
          .finally(() => {
            app.relaunch();
            app.quit();
          })
          .catch(() => {});
      });
    },
  };
};
