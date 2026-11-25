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
  let pendingInstallation: DesktopUpdateOutcome | undefined;
  let promptForUpgrade = false;
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
    take(downloadedVersion?: string | null): DesktopUpdateNotice | undefined {
      const outcome = pending;
      const installed = pendingInstallation;
      pending = undefined;
      pendingInstallation = undefined;
      const title = progressTitle;
      const upgrade = downloadedVersion ? { version: downloadedVersion, prompt: promptForUpgrade } : undefined;
      promptForUpgrade = false;
      if (title === undefined && !installed && !upgrade) return outcome;
      if (title === null) progressTitle = undefined;
      return {
        kind: "progress",
        title,
        ...(outcome ? { outcome } : {}),
        ...(installed ? { installed } : {}),
        ...(upgrade ? { upgrade } : {}),
      };
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
    downloaded: (version: string, interactive: boolean) => {
      options.receipt.recordDownload(version);
      if (progressTitle) progressTitle = null;
      promptForUpgrade ||= interactive;
      options.onNotice();
    },
    installed: () => {
      try {
        if (options.receipt.consumeInstalled(options.currentVersion)) {
          pendingInstallation = {
            level: "info",
            title: "Prompt Studio was updated successfully.",
            message: `You're now running Prompt Studio ${options.currentVersion}.`,
          };
          options.onNotice();
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
