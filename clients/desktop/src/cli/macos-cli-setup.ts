import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { app, dialog } from "electron";
import { DesktopCliInstallation } from "./desktop-cli-installation";

const execute = promisify(execFile);

export const createMacOSCliSetup = (logError: (error: Error) => void) => {
  // A DMG, source build, or unpacked test app is not a stable command target.
  if (process.platform !== "darwin" || !app.isPackaged || !app.isInApplicationsFolder()) return null;

  const installation = new DesktopCliInstallation({
    binary: join(process.resourcesPath, "bin", "pstdio"),
    command: "/usr/local/bin/pst",
    receiptPath: join(app.getPath("userData"), "cli-setup-attempted"),
    authorize: async (script) => {
      // Pass the shell program as data; application paths never become AppleScript source.
      await execute("/usr/bin/osascript", [
        "-e",
        "on run argv\ndo shell script (item 1 of argv) with administrator privileges\nend run",
        script,
      ]);
    },
  });
  const report = (error: unknown) => logError(error instanceof Error ? error : new Error(String(error)));

  return {
    onFirstLaunch: async () => {
      try {
        await installation.onFirstLaunch();
      } catch (error) {
        report(error);
      }
    },
    install: async () => {
      try {
        const result = await installation.install();
        await dialog.showMessageBox({
          type: "info",
          title: "Prompt Studio",
          message: result === "installed" ? "The pst command is ready." : "A pst command is already installed.",
          detail:
            result === "installed"
              ? "Run pst --version in Terminal to check it."
              : "Prompt Studio kept /usr/local/bin/pst. Remove the other CLI installation first, then try again.",
          buttons: ["OK"],
        });
      } catch (error) {
        report(error);
        await dialog.showMessageBox({
          type: "error",
          title: "Prompt Studio",
          message: "The pst command was not installed.",
          detail: "You can try again from Prompt Studio → Install pst Command…",
          buttons: ["OK"],
        });
      }
    },
  };
};
