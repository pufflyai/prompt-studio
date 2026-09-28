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
  authorize: (script: string) => Promise<void>;
}

export class DesktopCliInstallation {
  readonly #options: DesktopCliInstallationOptions;
  #pending: Promise<"installed" | "conflict"> | null = null;

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
      // Remember the attempt, including cancellation, so launches never repeat a password prompt.
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
    const { binary, command, authorize } = this.#options;
    accessSync(binary, constants.X_OK);
    const existing = this.#existingLink();
    if (existing) return existing;
    try {
      mkdirSync(dirname(command), { recursive: true });
      symlinkSync(binary, command);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EACCES" || code === "EPERM") await authorize(`set -eu\n${cliInstallScript({ binary, command })}`);
      else if (code !== "EEXIST") throw error;
    }
    const installed = this.#existingLink();
    if (!installed) throw new Error("The pst command was not installed.");
    return installed;
  }
}
