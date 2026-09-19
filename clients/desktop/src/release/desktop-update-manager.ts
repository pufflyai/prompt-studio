import { gt } from "semver";
import { desktopReleasesUrl, resolveDesktopUpdateFeed, resolveDesktopUpdateStrategy } from "./release-config";

type NativeUpdater = {
  on: {
    (event: "update-not-available", listener: () => void): unknown;
    (event: "update-downloaded", listener: () => void): unknown;
    (event: "error", listener: (error: Error) => void): unknown;
  };
  setFeedURL: (options: { url: string }) => void;
  checkForUpdates: () => unknown;
};

type DesktopUpdateManagerOptions = {
  platform: NodeJS.Platform;
  arch: string;
  packaged: boolean;
  currentVersion: string;
  updater: NativeUpdater;
  openExternal: (url: string) => Promise<unknown>;
  onUpdateNotAvailable: () => void;
  onUpdateDownloaded: (version: string) => void;
  onUpdateError: (error: Error) => void;
  resolveUpdateFeed?: typeof resolveDesktopUpdateFeed;
};

export class DesktopUpdateManager {
  readonly #options: DesktopUpdateManagerOptions;
  #checkInProgress: Promise<void> | null = null;
  #download: ReturnType<typeof Promise.withResolvers<"downloaded" | "not-available">> | null = null;
  #downloadedVersion: string | null = null;

  constructor(options: DesktopUpdateManagerOptions) {
    this.#options = options;
    options.updater.on("update-not-available", () => this.#download?.resolve("not-available"));
    options.updater.on("update-downloaded", () => this.#download?.resolve("downloaded"));
    options.updater.on("error", (error) => this.#download?.reject(error));
  }

  checkForUpdates() {
    this.#checkInProgress ??= this.#check()
      .catch((error: unknown) => this.#options.onUpdateError(error instanceof Error ? error : new Error(String(error))))
      .finally(() => {
        this.#download = null;
        this.#checkInProgress = null;
      });
    return this.#checkInProgress;
  }

  async #check() {
    const strategy = resolveDesktopUpdateStrategy(this.#options.platform);
    if (!this.#options.packaged || strategy.kind === "manual") {
      await this.#options.openExternal(strategy.kind === "manual" ? strategy.releasesUrl : desktopReleasesUrl);
      return;
    }

    if (this.#downloadedVersion) {
      this.#options.onUpdateDownloaded(this.#downloadedVersion);
      return;
    }

    const release = await (this.#options.resolveUpdateFeed ?? resolveDesktopUpdateFeed)({
      platform: this.#options.platform,
      arch: this.#options.arch,
    });
    if (!gt(release.version, this.#options.currentVersion)) {
      this.#options.onUpdateNotAvailable();
      return;
    }

    this.#download = Promise.withResolvers();
    this.#options.updater.setFeedURL({ url: release.url });
    this.#options.updater.checkForUpdates();
    const result = await this.#download.promise;
    if (result === "not-available") {
      this.#options.onUpdateNotAvailable();
      return;
    }

    this.#downloadedVersion = release.version;
    this.#options.onUpdateDownloaded(release.version);
  }
}
