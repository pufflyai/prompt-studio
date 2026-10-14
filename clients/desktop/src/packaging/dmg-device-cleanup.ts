import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

export interface DmgAttachmentCallbacks {
  attach: (imagePath: string, callback: (error: Error | null, mountPath?: string) => void) => void;
  detach: (mountPath: string, callback: (error: Error | null) => void) => void;
}

interface AttachedImage {
  "system-entities": Array<{ "dev-entry": string; "mount-point"?: string }>;
}

const execute = promisify(execFile);

const attachImage = async (imagePath: string) => {
  const { stdout } = await execute("hdiutil", ["attach", imagePath, "-nobrowse", "-noverify", "-noautoopen", "-plist"]);
  const attachment = JSON.parse(
    execFileSync("plutil", ["-convert", "json", "-o", "-", "--", "-"], { input: stdout, encoding: "utf8" }),
  ) as AttachedImage;
  const device = attachment["system-entities"][0]?.["dev-entry"];
  const mountPath = attachment["system-entities"].find((entity) => entity["mount-point"])?.["mount-point"];
  if (!device || !mountPath) throw new Error(`The attached DMG has no device or mounted volume: ${imagePath}`);
  console.info("DMG attachment", JSON.stringify({ device, mountPath }));
  return { device, mountPath };
};

// ADR 0074 isolates appdmg's private callbacks until it owns cleanup by device identity.
export const withDmgDeviceCleanup = async <T>(hdiutil: DmgAttachmentCallbacks, make: () => Promise<T>) => {
  const originalAttach = hdiutil.attach;
  const originalDetach = hdiutil.detach;
  const devices = new Map<string, string>();
  hdiutil.attach = (imagePath, callback) => {
    void attachImage(imagePath).then(
      ({ device, mountPath }) => {
        devices.set(mountPath, device);
        callback(null, mountPath);
      },
      (error: Error) => callback(error),
    );
  };
  hdiutil.detach = (mountPath, callback) => {
    const device = devices.get(mountPath);
    if (!device) {
      callback(new Error(`The DMG builder does not own an attachment at ${mountPath}`));
      return;
    }
    originalDetach(device, (error) => {
      if (!error) devices.delete(mountPath);
      callback(error);
    });
  };
  try {
    return await make();
  } finally {
    hdiutil.attach = originalAttach;
    hdiutil.detach = originalDetach;
  }
};
