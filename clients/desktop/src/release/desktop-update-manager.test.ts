import { describe, expect, test } from "bun:test";
import { DesktopUpdateManager } from "./desktop-update-manager";

describe("DesktopUpdateManager", () => {
  test("checks the native feed for a packaged macOS application", async () => {
    const calls: unknown[] = [];
    const manager = new DesktopUpdateManager({
      platform: "darwin",
      arch: "arm64",
      packaged: true,
      updater: {
        setFeedURL: (options) => calls.push(options),
        checkForUpdates: async () => calls.push("check"),
      },
      openExternal: async (url) => calls.push(url),
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
    }).checkForUpdates();
    await new DesktopUpdateManager({
      platform: "darwin",
      arch: "arm64",
      packaged: false,
      updater,
      openExternal: async (url) => opened.push(url),
    }).checkForUpdates();

    expect(opened).toEqual([
      "https://github.com/pufflyai/prompt-studio/releases",
      "https://github.com/pufflyai/prompt-studio/releases",
    ]);
  });
});
