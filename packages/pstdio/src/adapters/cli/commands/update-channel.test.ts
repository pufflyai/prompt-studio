import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readUpdateChannel } from "pstdio-paths";
import { createHandler } from "./update-channel";

const roots: string[] = [];
const channelPath = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-update-channel-cli-"));
  roots.push(root);
  return join(root, "desktop", "update-channel.json");
};

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

const run = async (path: string, platform: NodeJS.Platform, channel?: string) => {
  const lines: string[] = [];
  await createHandler({ resolvePath: () => path, platform, log: (line) => lines.push(line) })({ channel });
  return lines;
};

describe("update-channel command", () => {
  test("prints the channel and changes it for the desktop app on this device", async () => {
    const path = channelPath();
    expect(await run(path, "darwin")).toEqual(["stable"]);

    expect(await run(path, "darwin", "nightly")).toEqual([
      "Update channel set to nightly. Use Check for Updates in Prompt Studio desktop to update now.",
    ]);
    expect(readUpdateChannel(path)).toBe("nightly");
    expect(await run(path, "linux")).toEqual(["nightly"]);
  });

  test("keeps Windows on stable because no nightly builds exist for it", async () => {
    const path = channelPath();
    await expect(run(path, "win32", "nightly")).rejects.toThrow(
      "Nightly builds are only published for macOS and Linux.",
    );
    expect(await run(path, "win32")).toEqual(["stable"]);
    expect(await run(path, "win32", "stable")).toEqual([
      "Update channel set to stable. Use Check for Updates in Prompt Studio desktop to update now.",
    ]);
  });
});
