import { accessSync, constants, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { WindowsPathAction } from "./windows-path";
import { updateWindowsUserPath } from "./windows-user-path";

interface WindowsCliOptions {
  installRoot: string;
  binary: string;
  updatePath?: (directory: string, action: WindowsPathAction) => Promise<void>;
}

const marker = "@rem Prompt Studio desktop command\r\n";

export class WindowsCliInstallation {
  readonly #options: WindowsCliOptions;

  constructor(options: WindowsCliOptions) {
    this.#options = options;
  }

  async install() {
    const { installRoot, binary, updatePath = updateWindowsUserPath } = this.#options;
    accessSync(binary, constants.F_OK);
    const directory = join(installRoot, "bin");
    const command = join(directory, "pst.cmd");
    if (!this.#owned(command)) return "conflict" as const;
    mkdirSync(directory, { recursive: true });
    // Keep the launcher outside Squirrel's versioned folders so PATH survives updates.
    const target = relative(directory, binary).replaceAll("%", "%%");
    writeFileSync(
      command,
      `${marker}@setlocal DisableDelayedExpansion\r\n@"%~dp0${target}" %*\r\n@exit /b %errorlevel%\r\n`,
    );
    await updatePath(directory, "install");
    return "installed" as const;
  }

  async uninstall() {
    const { installRoot, updatePath = updateWindowsUserPath } = this.#options;
    const directory = join(installRoot, "bin");
    const command = join(directory, "pst.cmd");
    if (!this.#owned(command)) return;
    rmSync(command, { force: true });
    await updatePath(directory, "uninstall");
  }

  #owned(command: string) {
    try {
      return readFileSync(command, "utf8").startsWith(marker);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
      throw error;
    }
  }
}
