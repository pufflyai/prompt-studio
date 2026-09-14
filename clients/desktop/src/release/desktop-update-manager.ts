import { desktopReleasesUrl, resolveDesktopUpdateFeed, resolveDesktopUpdateStrategy } from "./release-config";

type NativeUpdater = {
  on: (event: "update-not-available", listener: () => void) => unknown;
  setFeedURL: (options: { url: string }) => void;
  checkForUpdates: () => unknown;
};

type DesktopUpdateManagerOptions = {
  platform: NodeJS.Platform;
  arch: string;
  packaged: boolean;
  updater: NativeUpdater;
  openExternal: (url: string) => Promise<unknown>;
  onUpdateNotAvailable: () => void;
  resolveUpdateFeed?: typeof resolveDesktopUpdateFeed;
};

export class DesktopUpdateManager {
  readonly #options: DesktopUpdateManagerOptions;

  constructor(options: DesktopUpdateManagerOptions) {
    this.#options = options;
    options.updater.on("update-not-available", options.onUpdateNotAvailable);
  }

  async checkForUpdates() {
    const strategy = resolveDesktopUpdateStrategy(this.#options.platform);
    if (!this.#options.packaged || strategy.kind === "manual") {
      await this.#options.openExternal(strategy.kind === "manual" ? strategy.releasesUrl : desktopReleasesUrl);
      return;
    }

    const feedUrl = await (this.#options.resolveUpdateFeed ?? resolveDesktopUpdateFeed)({
      platform: this.#options.platform,
      arch: this.#options.arch,
    });
    this.#options.updater.setFeedURL({ url: feedUrl });
    await this.#options.updater.checkForUpdates();
  }
}
