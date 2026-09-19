import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gt, valid } from "semver";

export class DesktopUpdateReceipt {
  readonly #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  recordDownload(version: string) {
    mkdirSync(dirname(this.#path), { recursive: true });
    writeFileSync(this.#path, `${version}\n`, "utf8");
  }

  consumeInstalled(currentVersion: string) {
    let downloadedVersion: string;
    try {
      downloadedVersion = readFileSync(this.#path, "utf8").trim();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }

    // A download can survive a quit that did not install it. Confirm only the version that actually started.
    if (valid(downloadedVersion) && gt(downloadedVersion, currentVersion)) return false;
    rmSync(this.#path);
    return downloadedVersion === currentVersion;
  }
}
