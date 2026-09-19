import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { DesktopUpdateManager } from "./desktop-update-manager";

const createUpdateCheck = (options: { currentVersion?: string; releaseVersion?: string; event?: string } = {}) => {
  const events = new EventEmitter();
  const notifications: string[] = [];
  const errors: Error[] = [];
  const feeds: unknown[] = [];
  let checks = 0;
  const manager = new DesktopUpdateManager({
    platform: "darwin",
    arch: "arm64",
    packaged: true,
    currentVersion: options.currentVersion ?? "0.33.2",
    updater: Object.assign(events, {
      setFeedURL: (feed: unknown) => feeds.push(feed),
      checkForUpdates: () => {
        checks += 1;
        if (options.event) events.emit(options.event);
      },
    }),
    openExternal: async () => {},
    onUpdateNotAvailable: () => notifications.push("up-to-date"),
    onUpdateDownloaded: (version: string) => notifications.push(`downloaded:${version}`),
    onUpdateError: (error: Error) => errors.push(error),
    resolveUpdateFeed: async () => ({ version: options.releaseVersion ?? "0.33.3", url: "https://example.com/update" }),
  });
  return { manager, events, notifications, errors, feeds, checks: () => checks };
};

describe("desktop update results", () => {
  test.each([
    "0.33.3",
    "0.34.0",
  ])("reports %s as up to date without downloading an equal or older release", async (version) => {
    const check = createUpdateCheck({ currentVersion: version, event: "update-downloaded" });
    await check.manager.checkForUpdates();
    expect(check.notifications).toEqual(["up-to-date"]);
    expect(check.checks()).toBe(0);
    expect(check.feeds).toEqual([]);
  });

  test("notifies when the native updater has verified and downloaded the newer version", async () => {
    const check = createUpdateCheck({ event: "update-downloaded" });
    await check.manager.checkForUpdates();
    expect(check.notifications).toEqual(["downloaded:0.33.3"]);
    expect(check.feeds).toEqual([{ url: "https://example.com/update" }]);
  });

  test("reports a native no-update result once per check", async () => {
    const check = createUpdateCheck({ event: "update-not-available" });
    await check.manager.checkForUpdates();
    await check.manager.checkForUpdates();
    expect(check.notifications).toEqual(["up-to-date", "up-to-date"]);
  });

  test("waits for download completion and shares concurrent requests", async () => {
    const check = createUpdateCheck();
    const first = check.manager.checkForUpdates();
    const second = check.manager.checkForUpdates();
    await Promise.resolve();
    check.events.emit("update-available");
    expect(check.notifications).toEqual([]);
    expect(check.checks()).toBe(1);
    check.events.emit("update-downloaded");
    await Promise.all([first, second]);
    expect(check.notifications).toEqual(["downloaded:0.33.3"]);
  });

  test("allows a retry after a native error without reporting a successful download", async () => {
    const check = createUpdateCheck();
    const first = check.manager.checkForUpdates();
    await Promise.resolve();
    check.events.emit("error", new Error("signature rejected"));
    await first;
    expect(check.errors.map((error) => error.message)).toEqual(["signature rejected"]);
    expect(check.notifications).toEqual([]);
    const retry = check.manager.checkForUpdates();
    await Promise.resolve();
    check.events.emit("update-downloaded");
    await retry;
    expect(check.checks()).toBe(2);
    expect(check.notifications).toEqual(["downloaded:0.33.3"]);
  });

  test("opens releases for Linux and source builds", async () => {
    const opened: string[] = [];
    for (const target of [
      { platform: "linux", packaged: true },
      { platform: "darwin", packaged: false },
    ] as const) {
      const manager = new DesktopUpdateManager({
        ...target,
        arch: "arm64",
        currentVersion: "0.33.2",
        updater: Object.assign(new EventEmitter(), {
          setFeedURL: () => {
            throw new Error("Unexpected native download");
          },
          checkForUpdates: () => {
            throw new Error("Unexpected native check");
          },
        }),
        openExternal: async (url) => {
          opened.push(url);
        },
        onUpdateNotAvailable: () => {},
        onUpdateDownloaded: () => {},
        onUpdateError: (error) => {
          throw error;
        },
      });
      await manager.checkForUpdates();
    }
    expect(opened).toEqual(Array(2).fill("https://github.com/pufflyai/prompt-studio/releases"));
  });

  test("a second check keeps a downloaded update discoverable without downloading again", async () => {
    const check = createUpdateCheck({ event: "update-downloaded" });
    await check.manager.checkForUpdates();
    await check.manager.checkForUpdates();
    expect(check.checks()).toBe(1);
    expect(check.notifications).toEqual(["downloaded:0.33.3", "downloaded:0.33.3"]);
  });
});
