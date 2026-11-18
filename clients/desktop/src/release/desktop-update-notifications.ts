import type { DesktopUpdateNotice } from "../desktop-api";
import type { DesktopUpdateReceipt } from "./desktop-update-receipt";

interface DesktopUpdateNotificationsOptions {
  currentVersion: string;
  receipt: Pick<DesktopUpdateReceipt, "recordDownload" | "consumeInstalled">;
  onNotice: () => void;
  logError: (error: Error) => void;
}

export const createDesktopUpdateNotifications = (options: DesktopUpdateNotificationsOptions) => {
  let pending: DesktopUpdateNotice | undefined;
  const show = (title: string, message?: string, level: DesktopUpdateNotice["level"] = "info") => {
    pending = { level, title, message };
    options.onNotice();
  };

  return {
    take() {
      const notice = pending;
      pending = undefined;
      return notice;
    },
    notAvailable: () =>
      show(
        "You're up to date.",
        `You're running Prompt Studio ${options.currentVersion}. There are no newer updates available for this installation.`,
      ),
    downloaded: (version: string) => {
      options.receipt.recordDownload(version);
      show(
        "Your update is ready to install.",
        `Prompt Studio ${version} has been downloaded. Quit and reopen Prompt Studio to install it.`,
      );
    },
    installed: () => {
      try {
        if (options.receipt.consumeInstalled(options.currentVersion)) {
          show(
            "Prompt Studio was updated successfully.",
            `You're now running Prompt Studio ${options.currentVersion}.`,
          );
        }
      } catch (error) {
        options.logError(error instanceof Error ? error : new Error(String(error)));
      }
    },
    failed: (error: Error) => {
      options.logError(error);
      show(
        "Prompt Studio couldn't complete the update.",
        "Please try Check for Updates again. If the problem continues, open the application logs for details.",
        "error",
      );
    },
  };
};
