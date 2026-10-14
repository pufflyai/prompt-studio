import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { app, dialog } from "electron";
import { DesktopCliInstallation } from "./desktop-cli-installation";

const execute = promisify(execFile);

const COMMAND = "/usr/local/bin/pst";
const MENU_ITEM = "Prompt Studio → Install pst Command…";

export const createMacOSCliSetup = (logError: (error: Error) => void) => {
  // A DMG, source build, or unpacked test app is not a stable command target.
  if (process.platform !== "darwin" || !app.isPackaged || !app.isInApplicationsFolder()) return null;

  const installation = new DesktopCliInstallation({
    binary: join(process.resourcesPath, "bin", "pstdio"),
    command: COMMAND,
    receiptPath: join(app.getPath("userData"), "cli-setup-attempted"),
    confirm: async () => {
      const { response } = await dialog.showMessageBox({
        type: "question",
        title: "Prompt Studio",
        message: "Install the pst command?",
        detail: [
          "This command lets you and agents use Prompt Studio from the Terminal by calling pst.",
          "You will need to provide your password to complete the installation.",
          `You can also do this later from ${MENU_ITEM}`,
        ].join("\n\n"),
        buttons: ["Install", "Not Now"],
        defaultId: 0,
        cancelId: 1,
      });
      return response === 0;
    },
    authorize: async (script) => {
      try {
        // Pass the shell program as data; application paths never become AppleScript source.
        await execute("/usr/bin/osascript", [
          "-e",
          "on run argv\ndo shell script (item 1 of argv) with prompt (item 2 of argv) with administrator privileges\nend run",
          script,
          `Prompt Studio needs your password to add the pst command to ${dirname(COMMAND)}.`,
        ]);
        return true;
      } catch (error) {
        // -128 is the AppleScript error for a cancelled password window.
        if ((error as { stderr?: string }).stderr?.includes("(-128)")) return false;
        throw error;
      }
    },
  });

  const showReady = () =>
    dialog.showMessageBox({
      type: "info",
      title: "Prompt Studio",
      message: "The pst command is ready.",
      detail: "Open a new Terminal window and run pst --version to check it.",
      buttons: ["OK"],
    });
  const showFailure = (error: unknown) => {
    logError(error instanceof Error ? error : new Error(String(error)));
    return dialog.showMessageBox({
      type: "error",
      title: "Prompt Studio",
      message: "The pst command was not installed.",
      detail: `You can try again from ${MENU_ITEM}`,
      buttons: ["OK"],
    });
  };

  return {
    offerOnce: async () => {
      try {
        // A decline needs no reply, and another pst stays the person's choice.
        if ((await installation.offerOnce()) === "installed") await showReady();
      } catch (error) {
        await showFailure(error);
      }
    },
    install: async () => {
      try {
        const result = await installation.install();
        if (result === "installed") await showReady();
        if (result === "conflict")
          await dialog.showMessageBox({
            type: "info",
            title: "Prompt Studio",
            message: "A pst command is already installed.",
            detail: `Prompt Studio kept ${COMMAND}. Remove the other CLI installation first, then try again.`,
            buttons: ["OK"],
          });
      } catch (error) {
        await showFailure(error);
      }
    },
  };
};
