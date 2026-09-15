import type { MessageBoxOptions } from "electron";
import type { DesktopUpdateReceipt } from "./desktop-update-receipt";

interface DesktopUpdateNotificationsOptions {
  currentVersion: string;
  receipt: DesktopUpdateReceipt;
  showMessageBox: (options: MessageBoxOptions) => Promise<unknown>;
  logError: (error: Error) => void;
}

export const createDesktopUpdateNotifications = (options: DesktopUpdateNotificationsOptions) => {
  const show = (message: string, detail?: string, type: "info" | "error" = "info") => {
    void options
      .showMessageBox({ type, title: "Prompt Studio Update", message, detail, buttons: ["OK"] })
      .catch(options.logError);
  };

  return {
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
