import { expect, test } from "bun:test";
import { execFile, execFileSync } from "node:child_process";
import { closeSync, existsSync, mkdtempSync, openSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { type DmgAttachmentCallbacks, withDmgDeviceCleanup } from "./dmg-device-cleanup";

const execute = promisify(execFile);
const nativeTest = process.platform === "darwin" ? test : test.skip;

interface ImageInventory {
  images: Array<{ "image-path": string; "system-entities": Array<{ "dev-entry": string }> }>;
}

nativeTest(
  "detaches its image after the volume is unmounted",
  async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-dmg-cleanup-")));
    const image = join(root, "fixture.dmg");
    const forgeRequire = createRequire(require.resolve("@electron-forge/maker-dmg"));
    const installerRequire = createRequire(forgeRequire.resolve("electron-installer-dmg"));
    const appdmgRequire = createRequire(installerRequire.resolve("appdmg"));
    const hdiutil = appdmgRequire("./lib/hdiutil") as DmgAttachmentCallbacks;
    const started = performance.now();
    const phase = (name: string) =>
      console.info(`DMG cleanup fixture: ${name} +${Math.round(performance.now() - started)}ms`);
    try {
      await execute("hdiutil", ["create", image, "-size", "16m", "-fs", "HFS+", "-volname", "Pstdio cleanup fixture"]);
      phase("created");
      await withDmgDeviceCleanup(hdiutil, async () => {
        const mountPath = await new Promise<string>((resolve, reject) => {
          hdiutil.attach(image, (error, mounted) => {
            if (error) reject(error);
            else resolve(mounted!);
          });
        });
        phase("attached");
        const file = openSync(join(mountPath, "open-fixture-file"), "w");
        try {
          // Establish the missing-mount precondition even while a process uses this owned test volume.
          // The production detach adapter must still release the attached device afterwards.
          await execute("diskutil", ["unmount", "force", mountPath]);
        } finally {
          closeSync(file);
        }
        phase("unmounted");
        expect(existsSync(mountPath)).toBe(false);
        const result = await new Promise<Error | null>((resolve) => hdiutil.detach(mountPath, resolve));
        phase("detached");
        expect(result).toBeNull();
        const remaining = await execute("hdiutil", ["info"]);
        expect(remaining.stdout).not.toContain(image);
      });
    } finally {
      const { stdout } = await execute("hdiutil", ["info", "-plist"]);
      const inventory = JSON.parse(
        execFileSync("plutil", ["-convert", "json", "-o", "-", "--", "-"], { input: stdout, encoding: "utf8" }),
      ) as ImageInventory;
      const attached = inventory.images.find((item) => item["image-path"] === image);
      if (attached) await execute("hdiutil", ["detach", attached["system-entities"][0]["dev-entry"]]);
      rmSync(root, { recursive: true, force: true });
      phase("cleaned");
    }
  },
  10_000,
);
