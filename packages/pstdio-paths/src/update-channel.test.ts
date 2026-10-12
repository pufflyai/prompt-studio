import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolvePstdioUpdateChannelPath } from "./index";
import { readUpdateChannel, updateChannelAvailable, writeUpdateChannel } from "./update-channel";

const roots: string[] = [];
const preferencePath = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-update-channel-"));
  roots.push(root);
  return join(root, "desktop", "update-channel.json");
};

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe("update channel preference", () => {
  test("is stable until this device chooses nightly, and survives a restart", () => {
    const path = preferencePath();
    expect(readUpdateChannel(path)).toBe("stable");

    writeUpdateChannel(path, "nightly");
    expect(readUpdateChannel(path)).toBe("nightly");

    writeUpdateChannel(path, "stable");
    expect(readUpdateChannel(path)).toBe("stable");
  });

  test("treats an unreadable or unknown value as stable", () => {
    const path = preferencePath();
    writeUpdateChannel(path, "nightly");
    writeFileSync(path, "{not json", "utf8");
    expect(readUpdateChannel(path)).toBe("stable");
    writeFileSync(path, '{"channel":"beta"}', "utf8");
    expect(readUpdateChannel(path)).toBe("stable");
  });

  test("lives in the Prompt Studio home so the desktop app and pst share it", () => {
    const home = resolve("/tmp/pstdio-home");
    expect(resolvePstdioUpdateChannelPath({ env: { PSTDIO_HOME: home } })).toBe(
      resolve(home, "desktop/update-channel.json"),
    );
  });

  test("nightly builds exist only for macOS and Linux", () => {
    expect(updateChannelAvailable("darwin")).toBe(true);
    expect(updateChannelAvailable("linux")).toBe(true);
    expect(updateChannelAvailable("win32")).toBe(false);
  });
});
