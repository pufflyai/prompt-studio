import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { cliInstallScript } from "./cli-link";

interface DesktopCliInstallationOptions {
  binary: string;
  command: string;
  receiptPath: string;
  /** Explains the password prompt. `false` means the person chose not to install now. */
  confirm: () => Promise<boolean>;
  /** Runs the script with administrator rights. `false` means the person cancelled the password prompt. */
  authorize: (script: string) => Promise<boolean>;
}

export class DesktopCliInstallation {
  readonly #options: DesktopCliInstallationOptions;
  #pending: Promise<"installed" | "conflict" | "declined"> | null = null;

  constructor(options: DesktopCliInstallationOptions) {
    this.#options = options;
  }

  async onFirstLaunch() {
    if (existsSync(this.#options.receiptPath)) return null;
    return this.install();
  }

  #recordAttempt() {
    const { receiptPath } = this.#options;
    mkdirSync(dirname(receiptPath), { recursive: true });
    try {
      // Remember the attempt, including a decline, so later launches never ask again.
      writeFileSync(receiptPath, "", { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }

  install() {
    this.#pending ??= this.#install().finally(() => {
      this.#pending = null;
    });
    return this.#pending;
  }

  #existingLink() {
    const { binary, command } = this.#options;
    try {
      const entry = lstatSync(command);
      if (entry.isSymbolicLink() && resolve(dirname(command), readlinkSync(command)) === binary)
        return "installed" as const;
      return "conflict" as const;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async #install() {
    this.#recordAttempt();
    const { binary, command, confirm, authorize } = this.#options;
    accessSync(binary, constants.X_OK);
    const existing = this.#existingLink();
    if (existing) return existing;
    try {
      mkdirSync(dirname(command), { recursive: true });
      symlinkSync(binary, command);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EACCES" || code === "EPERM") {
        // macOS asks for the password in a window named after osascript, so explain it first.
        if (!(await confirm())) return "declined";
        if (!(await authorize(`set -eu\n${cliInstallScript({ binary, command })}`))) return "declined";
      } else if (code !== "EEXIST") throw error;
    }
    const installed = this.#existingLink();
    if (!installed) throw new Error("The pst command was not installed.");
    return installed;
  }
}
