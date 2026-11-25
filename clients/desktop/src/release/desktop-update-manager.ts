import type { UpdateChannel } from "pstdio-paths";
import { gt } from "semver";
import type { DesktopUpdatePhase } from "../desktop-api";
import {
  desktopReleasesUrl,
  type GitHubRelease,
  resolveDesktopReleasePage,
  resolveDesktopUpdateFeed,
  resolveDesktopUpdateStrategy,
} from "./release-config";

type NativeUpdater = {
  on: {
    (event: "update-available", listener: () => void): unknown;
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
  channel: () => UpdateChannel;
  updater: NativeUpdater;
  openExternal: (url: string) => Promise<unknown>;
  onUpdateProgress?: (phase: DesktopUpdatePhase | undefined) => void;
  onUpdateNotAvailable: () => void;
  onUpdateDownloaded: (version: string, interactive: boolean) => void;
  onUpdateError: (error: Error) => void;
  logError: (error: Error) => void;
  fetchReleases?: () => Promise<GitHubRelease[]>;
};

export class DesktopUpdateManager {
  readonly #options: DesktopUpdateManagerOptions;
  #checkInProgress: Promise<void> | null = null;
  // A person asked during this check, so it must answer even if it started in the background.
  #interactive = false;
  #phase: DesktopUpdatePhase | undefined;
  #download: ReturnType<typeof Promise.withResolvers<"downloaded" | "not-available">> | null = null;
  #downloadedVersion: string | null = null;

  constructor(options: DesktopUpdateManagerOptions) {
    this.#options = options;
    options.updater.on("update-available", () => {
      if (this.#download) this.#setPhase("downloading");
    });
    options.updater.on("update-not-available", () => this.#download?.resolve("not-available"));
    options.updater.on("update-downloaded", () => this.#download?.resolve("downloaded"));
    options.updater.on("error", (error) => this.#download?.reject(error));
  }

  get downloadedVersion() {
    return this.#downloadedVersion;
  }

  checkForUpdates() {
    if (!this.#interactive) {
      this.#interactive = true;
      if (this.#phase) this.#options.onUpdateProgress?.(this.#phase);
    }
    return this.#run();
  }

  // Scheduled checks only download. Opening a browser or showing "up to date" every
  // few hours would interrupt work, so they do nothing where no native updater runs.
  checkInBackground() {
    if (!this.#options.packaged || resolveDesktopUpdateStrategy(this.#options.platform).kind === "manual") {
      return Promise.resolve();
    }
    if (this.#downloadedVersion && !this.#checkInProgress) return Promise.resolve();
    return this.#run();
  }

  #setPhase(phase: DesktopUpdatePhase | undefined) {
    if (phase === this.#phase) return;
    this.#phase = phase;
    if (this.#interactive) this.#options.onUpdateProgress?.(phase);
  }

  #run() {
    this.#checkInProgress ??= this.#check()
      .catch((error: unknown) => {
        const failure = error instanceof Error ? error : new Error(String(error));
        if (this.#interactive) this.#options.onUpdateError(failure);
        else this.#options.logError(failure);
      })
      .finally(() => {
        this.#setPhase(undefined);
        this.#download = null;
        this.#checkInProgress = null;
        this.#interactive = false;
      });
    return this.#checkInProgress;
  }

  async #check() {
    this.#setPhase("checking");
    const lookup = {
      platform: this.#options.platform,
      arch: this.#options.arch,
      channel: this.#options.channel(),
      ...(this.#options.fetchReleases ? { fetchReleases: this.#options.fetchReleases } : {}),
    };
    if (!this.#options.packaged) {
      await this.#options.openExternal(desktopReleasesUrl);
      return;
    }
    const manual = resolveDesktopUpdateStrategy(this.#options.platform).kind === "manual";
    if (!manual && this.#downloadedVersion) {
      this.#options.onUpdateDownloaded(this.#downloadedVersion, this.#interactive);
      return;
    }

    const release = await (manual ? resolveDesktopReleasePage : resolveDesktopUpdateFeed)(lookup);
    // Never offer an older version, even after switching from nightly back to stable.
    // An older app would run on a database that newer migrations already changed.
    if (!gt(release.version, this.#options.currentVersion)) {
      if (this.#interactive) this.#options.onUpdateNotAvailable();
      return;
    }
    if (manual) {
      await this.#options.openExternal(release.url);
      return;
    }

    this.#download = Promise.withResolvers();
    this.#options.updater.setFeedURL({ url: release.url });
    this.#options.updater.checkForUpdates();
    const result = await this.#download.promise;
    if (result === "not-available") {
      if (this.#interactive) this.#options.onUpdateNotAvailable();
      return;
    }

    this.#downloadedVersion = release.version;
    this.#options.onUpdateDownloaded(release.version, this.#interactive);
  }
}
