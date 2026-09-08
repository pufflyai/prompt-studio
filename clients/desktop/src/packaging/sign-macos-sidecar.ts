import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export const signMacOSSidecar = (binaryPath: string, identity: string) => {
  const result = spawnSync(
    "codesign",
    [
      "--force",
      "--sign",
      identity,
      "--identifier",
      "studio.prompt.desktop.runtime",
      "--options",
      "runtime",
      "--timestamp",
      "--entitlements",
      resolve(import.meta.dirname, "../../assets/runtime.entitlements.plist"),
      binaryPath,
    ],
    { encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Desktop runtime signing failed: ${result.stderr.trim()}`);
};
