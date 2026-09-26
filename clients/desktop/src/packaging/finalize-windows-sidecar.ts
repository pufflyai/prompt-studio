import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const finalizeWindowsSidecar = (resourcesPath: string) => {
  const manifestPath = join(resourcesPath, "bin", "pstdio.manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  // Windows Packager signs extra resources after copying them into the app.
  const binary = readFileSync(join(resourcesPath, "bin", "pstdio.exe"));
  manifest.checksum = createHash("sha256").update(binary).digest("hex");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
};
