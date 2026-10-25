import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { DesktopUpdateManager } from "./desktop-update-manager";

const macRelease = (version: string) => ({
  tag_name: `pstdio@${version}`,
  draft: false,
  prerelease: version.includes("-"),
  assets: [{ name: `Prompt-Studio-${version}-darwin-arm64.zip` }, { name: "RELEASES-darwin-arm64.json" }],
});

const feedUrl = (version: string) =>
  `https://github.com/pufflyai/prompt-studio/releases/download/pstdio@${version}/RELEASES-darwin-arm64.json`;

type UpdateCheckOptions = {
  currentVersion?: string;
  releaseVersions?: string[];
  channel?: "stable" | "nightly";
  event?: string;
};

const createUpdateCheck = (options: UpdateCheckOptions = {}) => {
  const events = new EventEmitter();
  const notifications: string[] = [];
  const errors: Error[] = [];
  const logged: Error[] = [];
  const feeds: unknown[] = [];
  let checks = 0;
  let channel = options.channel ?? "stable";
  const manager = new DesktopUpdateManager({
    platform: "darwin",
    arch: "arm64",
    packaged: true,
    currentVersion: options.currentVersion ?? "0.33.2",
    channel: () => channel,
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
    logError: (error: Error) => logged.push(error),
    fetchReleases: async () => (options.releaseVersions ?? ["0.33.3"]).map(macRelease),
  });
  const setChannel = (next: "stable" | "nightly") => {
    channel = next;
  };
  // The release lookup is asynchronous, so wait until the native updater has really started.
  const nativeCheckStarted = async (count: number) => {
    while (checks < count) await Bun.sleep(0);
  };
  return {
    manager,
    events,
    notifications,
    errors,
    logged,
    feeds,
    setChannel,
    nativeCheckStarted,
    checks: () => checks,
  };
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
    expect(check.feeds).toEqual([{ url: feedUrl("0.33.3") }]);
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
    await check.nativeCheckStarted(1);
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
    await check.nativeCheckStarted(1);
    check.events.emit("error", new Error("signature rejected"));
    await first;
    expect(check.errors.map((error) => error.message)).toEqual(["signature rejected"]);
    expect(check.notifications).toEqual([]);
    const retry = check.manager.checkForUpdates();
    await check.nativeCheckStarted(2);
    check.events.emit("update-downloaded");
    await retry;
    expect(check.checks()).toBe(2);
    expect(check.notifications).toEqual(["downloaded:0.33.3"]);
  });

  test("opens the release page for Linux and the releases list for source builds", async () => {
    const opened: string[] = [];
    for (const target of [
      { platform: "linux", packaged: true },
      { platform: "darwin", packaged: false },
    ] as const) {
      const manager = new DesktopUpdateManager({
        ...target,
        arch: "x64",
        currentVersion: "0.33.2",
        channel: () => "nightly",
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
        logError: (error) => {
          throw error;
        },
        fetchReleases: async () => [
          {
            tag_name: "pstdio@0.34.0-nightly.20261011030000",
            draft: false,
            prerelease: true,
            assets: [{ name: "Prompt-Studio-0.34.0-nightly.20261011030000-linux-x64.deb" }],
          },
        ],
      });
      await manager.checkForUpdates();
      await manager.checkInBackground();
    }
    expect(opened).toEqual([
      "https://github.com/pufflyai/prompt-studio/releases/tag/pstdio@0.34.0-nightly.20261011030000",
      "https://github.com/pufflyai/prompt-studio/releases",
    ]);
  });

  test("a second check keeps a downloaded update discoverable without downloading again", async () => {
    const check = createUpdateCheck({ event: "update-downloaded" });
    await check.manager.checkForUpdates();
    await check.manager.checkForUpdates();
    expect(check.checks()).toBe(1);
    expect(check.notifications).toEqual(["downloaded:0.33.3", "downloaded:0.33.3"]);
  });

  test("switching back to stable on a nightly build never offers an older stable release", async () => {
    const check = createUpdateCheck({
      currentVersion: "0.34.0-nightly.20261011030000",
      releaseVersions: ["0.33.3", "0.34.0-nightly.20261012030000"],
      channel: "nightly",
      event: "update-downloaded",
    });
    check.setChannel("stable");
    await check.manager.checkForUpdates();
    expect(check.notifications).toEqual(["up-to-date"]);
    expect(check.feeds).toEqual([]);
  });

  test("a nightly build moves to the stable release that replaces it", async () => {
    const check = createUpdateCheck({
      currentVersion: "0.34.0-nightly.20261011030000",
      releaseVersions: ["0.34.0", "0.34.0-nightly.20261012030000"],
      channel: "stable",
      event: "update-downloaded",
    });
    await check.manager.checkForUpdates();
    expect(check.notifications).toEqual(["downloaded:0.34.0"]);
    expect(check.feeds).toEqual([{ url: feedUrl("0.34.0") }]);
  });

  test("the nightly channel downloads the newest nightly build", async () => {
    const check = createUpdateCheck({
      releaseVersions: ["0.33.3", "0.34.0-nightly.20261012030000"],
      channel: "nightly",
      event: "update-downloaded",
    });
    await check.manager.checkForUpdates();
    expect(check.notifications).toEqual(["downloaded:0.34.0-nightly.20261012030000"]);
  });
});

describe("background update checks", () => {
  test("stay quiet when there is no update or the check fails", async () => {
    const quiet = createUpdateCheck({ currentVersion: "0.33.3" });
    await quiet.manager.checkInBackground();
    expect(quiet.notifications).toEqual([]);

    const failing = createUpdateCheck();
    const check = failing.manager.checkInBackground();
    await failing.nativeCheckStarted(1);
    failing.events.emit("error", new Error("offline"));
    await check;
    expect(failing.errors).toEqual([]);
    expect(failing.logged.map((error) => error.message)).toEqual(["offline"]);
  });

  test("show the downloaded prompt once per downloaded version", async () => {
    const check = createUpdateCheck({ event: "update-downloaded" });
    await check.manager.checkInBackground();
    await check.manager.checkInBackground();
    expect(check.notifications).toEqual(["downloaded:0.33.3"]);
    expect(check.checks()).toBe(1);
  });

  test("a person who asks during a background check still gets an answer", async () => {
    const check = createUpdateCheck({ currentVersion: "0.33.3" });
    const background = check.manager.checkInBackground();
    const manual = check.manager.checkForUpdates();
    await Promise.all([background, manual]);
    expect(check.notifications).toEqual(["up-to-date"]);
  });
});

describe("Linux update checks", () => {
  const linuxCheck = (currentVersion: string) => {
    const opened: string[] = [];
    const notifications: string[] = [];
    const manager = new DesktopUpdateManager({
      platform: "linux",
      arch: "x64",
      packaged: true,
      currentVersion,
      channel: () => "stable",
      updater: Object.assign(new EventEmitter(), { setFeedURL: () => {}, checkForUpdates: () => {} }),
      openExternal: async (url) => {
        opened.push(url);
      },
      onUpdateNotAvailable: () => notifications.push("up-to-date"),
      onUpdateDownloaded: () => {},
      onUpdateError: (error) => {
        throw error;
      },
      logError: (error) => {
        throw error;
      },
      fetchReleases: async () => [
        { tag_name: "pstdio@0.33.3", draft: false, prerelease: false, assets: [{ name: "x-linux-x64.deb" }] },
      ],
    });
    return { manager, opened, notifications };
  };

  test("never sends a nightly build back to an older stable release page", async () => {
    const check = linuxCheck("0.34.0-nightly.20261011030000");
    await check.manager.checkForUpdates();
    expect(check.opened).toEqual([]);
    expect(check.notifications).toEqual(["up-to-date"]);
  });

  test("opens the page of a newer release", async () => {
    const check = linuxCheck("0.33.2");
    await check.manager.checkForUpdates();
    expect(check.opened).toEqual(["https://github.com/pufflyai/prompt-studio/releases/tag/pstdio@0.33.3"]);
  });
});
