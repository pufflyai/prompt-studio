import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDesktopUpdateChannel } from "./desktop-update-channel";

const roots: string[] = [];
const channelPath = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-channel-"));
  roots.push(root);
  return join(root, "update-channel.json");
};

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe("desktop update channel", () => {
  test("a packaged macOS or Linux app follows the chosen channel", () => {
    const path = channelPath();
    const channel = createDesktopUpdateChannel({ path, platform: "linux", packaged: true });
    expect(channel.choice()).toBe("stable");
    channel.set("nightly");
    expect(channel.choice()).toBe("nightly");
    expect(channel.current()).toBe("nightly");
  });

  test("Windows and source builds stay on stable and offer no choice", () => {
    for (const target of [
      { platform: "win32", packaged: true },
      { platform: "darwin", packaged: false },
    ] as const) {
      const path = channelPath();
      createDesktopUpdateChannel({ path, platform: "darwin", packaged: true }).set("nightly");
      const channel = createDesktopUpdateChannel({ path, ...target });
      expect(channel.choice()).toBeNull();
      expect(channel.current()).toBe("stable");
      expect(() => channel.set("nightly")).toThrow("cannot change its update channel");
    }
  });
});
