import { createRequire } from "node:module";
import MakerDMG from "@electron-forge/maker-dmg";
import { type DmgAttachmentCallbacks, withDmgDeviceCleanup } from "./dmg-device-cleanup";

const desktopRequire = createRequire(import.meta.url);

export class DeviceDmgMaker extends MakerDMG {
  async make(options: Parameters<MakerDMG["make"]>[0]) {
    const forgeRequire = createRequire(desktopRequire.resolve("@electron-forge/maker-dmg"));
    const installerRequire = createRequire(forgeRequire.resolve("electron-installer-dmg"));
    const appdmgRequire = createRequire(installerRequire.resolve("appdmg"));
    const hdiutil = appdmgRequire("./lib/hdiutil") as DmgAttachmentCallbacks;
    return withDmgDeviceCleanup(hdiutil, () => super.make(options));
  }
}
