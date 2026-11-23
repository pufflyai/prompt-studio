import type { DesktopUpdateNotice, DesktopUpdateOutcome, DesktopUpdatePhase } from "../desktop-api";
import type { DesktopUpdateReceipt } from "./desktop-update-receipt";

interface DesktopUpdateNotificationsOptions {
  currentVersion: string;
  receipt: Pick<DesktopUpdateReceipt, "recordDownload" | "consumeInstalled">;
  onNotice: () => void;
  logError: (error: Error) => void;
}

const progressTitles = {
  checking: "Checking for updates…",
  downloading: "Downloading update…",
} satisfies Record<DesktopUpdatePhase, string>;

export const createDesktopUpdateNotifications = (options: DesktopUpdateNotificationsOptions) => {
  let pending: DesktopUpdateOutcome | undefined;
  // Keep the current phase available after a reload. Null delivers the clear once.
  let progressTitle: string | null | undefined;
  const show = (title: string, message: string, level: DesktopUpdateOutcome["level"] = "info") => {
    pending = { level, title, message };
    options.onNotice();
  };
  const settle = (title: string, message: string, level?: DesktopUpdateOutcome["level"]) => {
    if (progressTitle) progressTitle = null;
    show(title, message, level);
  };

  return {
    take(): DesktopUpdateNotice | undefined {
      const outcome = pending;
      pending = undefined;
      const title = progressTitle;
      if (title === undefined) return outcome;
      if (title === null) progressTitle = undefined;
      return { kind: "progress", title, ...(outcome ? { outcome } : {}) };
    },
    progress(phase: DesktopUpdatePhase | undefined) {
      if (!phase && !progressTitle) return;
      progressTitle = phase ? progressTitles[phase] : null;
      options.onNotice();
    },
    notAvailable: () =>
      settle(
        "You're up to date.",
        `You're running Prompt Studio ${options.currentVersion}. There are no newer updates available for this installation.`,
      ),
    downloaded: (version: string) => {
      options.receipt.recordDownload(version);
      settle(
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
      settle(
        "Prompt Studio couldn't complete the update.",
        "Please try Check for Updates again. If the problem continues, open the application logs for details.",
        "error",
      );
    },
  };
};
