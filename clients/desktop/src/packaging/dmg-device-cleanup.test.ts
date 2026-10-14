import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { type DmgAttachmentCallbacks, withDmgDeviceCleanup } from "./dmg-device-cleanup";

const execute = promisify(execFile);
const nativeTest = process.platform === "darwin" ? test : test.skip;

nativeTest("detaches its image after the volume is unmounted", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-dmg-cleanup-"));
  const image = join(root, "fixture.dmg");
  const forgeRequire = createRequire(require.resolve("@electron-forge/maker-dmg"));
  const installerRequire = createRequire(forgeRequire.resolve("electron-installer-dmg"));
  const appdmgRequire = createRequire(installerRequire.resolve("appdmg"));
  const hdiutil = appdmgRequire("./lib/hdiutil") as DmgAttachmentCallbacks;
  let device: string | undefined;
  try {
    await execute("hdiutil", ["create", image, "-size", "16m", "-fs", "HFS+", "-volname", "Pstdio cleanup fixture"]);
    await withDmgDeviceCleanup(hdiutil, async () => {
      const mountPath = await new Promise<string>((resolve, reject) => {
        hdiutil.attach(image, (error, mounted) => {
          if (error) reject(error);
          else resolve(mounted!);
        });
      });
      const { stdout } = await execute("diskutil", ["info", mountPath]);
      device = stdout.match(/Device Node:\s+(\/dev\/\S+)/)?.[1];
      expect(device).toMatch(/^\/dev\/disk/);
      await execute("diskutil", ["unmount", mountPath]);
      const result = await new Promise<Error | null>((resolve) => hdiutil.detach(mountPath, resolve));
      expect(result).toBeNull();
      const remaining = await execute("hdiutil", ["info"]);
      expect(remaining.stdout).not.toContain(image);
    });
  } finally {
    if (device) await execute("hdiutil", ["detach", device]).catch(() => {});
    rmSync(root, { recursive: true, force: true });
  }
});
