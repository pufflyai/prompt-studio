import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { DesktopUpdateManager } from "./desktop-update-manager";

describe("DesktopUpdateManager", () => {
  test("notifies once for each check that finds no update", async () => {
    const events = new EventEmitter();
    const notifications: string[] = [];
    const manager = new DesktopUpdateManager({
      platform: "darwin",
      arch: "arm64",
      packaged: true,
      updater: Object.assign(events, {
        setFeedURL: () => {},
        checkForUpdates: () => events.emit("update-not-available"),
      }),
      openExternal: async () => {},
      resolveUpdateFeed: async () => "https://example.com/RELEASES-darwin-arm64.json",
      onUpdateNotAvailable: () => notifications.push("no-update"),
    });

    expect(notifications).toEqual([]);
    await manager.checkForUpdates();
    expect(notifications).toEqual(["no-update"]);
    await manager.checkForUpdates();
    expect(notifications).toEqual(["no-update", "no-update"]);

    events.emit("update-available");
    expect(notifications).toHaveLength(2);
  });

  test("checks the native feed for a packaged macOS application", async () => {
    const calls: unknown[] = [];
    const manager = new DesktopUpdateManager({
      platform: "darwin",
      arch: "arm64",
      packaged: true,
      updater: {
        on: () => {},
        setFeedURL: (options) => calls.push(options),
        checkForUpdates: async () => calls.push("check"),
      },
      openExternal: async (url) => calls.push(url),
      onUpdateNotAvailable: () => {},
      resolveUpdateFeed: async () =>
        "https://github.com/pufflyai/prompt-studio/releases/download/pstdio@0.25.3/RELEASES-darwin-arm64.json",
    });

    await manager.checkForUpdates();

    expect(calls).toEqual([
      {
        url: "https://github.com/pufflyai/prompt-studio/releases/download/pstdio@0.25.3/RELEASES-darwin-arm64.json",
      },
      "check",
    ]);
  });

  test("opens GitHub releases for Linux and unpackaged builds", async () => {
    const opened: string[] = [];
    const updater = {
      on: () => {},
      setFeedURL: () => {
        throw new Error("native updater should not be configured");
      },
      checkForUpdates: async () => {
        throw new Error("native updater should not run");
      },
    };

    await new DesktopUpdateManager({
      platform: "linux",
      arch: "x64",
      packaged: true,
      updater,
      openExternal: async (url) => opened.push(url),
      onUpdateNotAvailable: () => {},
    }).checkForUpdates();
    await new DesktopUpdateManager({
      platform: "darwin",
      arch: "arm64",
      packaged: false,
      updater,
      openExternal: async (url) => opened.push(url),
      onUpdateNotAvailable: () => {},
    }).checkForUpdates();

    expect(opened).toEqual([
      "https://github.com/pufflyai/prompt-studio/releases",
      "https://github.com/pufflyai/prompt-studio/releases",
    ]);
  });
});
