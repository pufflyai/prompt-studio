/**
 * Every extension manifest in the repo must target the exact host extension API version.
 *
 * While the API is in alpha, EXTENSION_API_VERSION moves on every breaking contract change.
 * A manifest left on the previous version ships an extension the host refuses to load, so the
 * whole set has to move together. This check makes a half-migrated release fail here instead.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

const ROOT = path.resolve(import.meta.dir, "../..");

export interface ExtensionManifest {
  /** Path relative to the repo root, used in the error message. */
  file: string;
  enginesPstdio: string;
}

/** Tracked files only, so gitignored scratch folders from test runs are never picked up. */
export const listTrackedManifestFiles = (root: string) => {
  const result = spawnSync("git", ["ls-files", "*package.json"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ls-files failed: ${result.stderr.trim()}`);

  return result.stdout.split("\n").filter(Boolean);
};

export const readExtensionManifests = (root: string, files: string[]) => {
  const manifests: ExtensionManifest[] = [];

  for (const file of files) {
    let manifest: { engines?: Record<string, string> };
    try {
      manifest = JSON.parse(readFileSync(path.join(root, file), "utf8"));
    } catch {
      continue;
    }

    const enginesPstdio = manifest.engines?.pstdio;
    if (!enginesPstdio) continue;

    manifests.push({ file, enginesPstdio });
  }

  return manifests;
};

export const checkExtensionApiVersions = (manifests: ExtensionManifest[], hostVersion: string) =>
  manifests
    .filter((manifest) => manifest.enginesPstdio !== hostVersion)
    .map(
      (manifest) =>
        `${manifest.file}: engines.pstdio is "${manifest.enginesPstdio}" but must be exactly "${hostVersion}"`,
    );

const main = () => {
  const manifests = readExtensionManifests(ROOT, listTrackedManifestFiles(ROOT));
  if (manifests.length === 0) throw new Error("No extension manifests found — the scan is looking in the wrong place");

  const errors = checkExtensionApiVersions(manifests, EXTENSION_API_VERSION);
  if (errors.length > 0) {
    console.error(`Extension API version violations (${errors.length}):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log(`Extension API version OK: ${manifests.length} manifests declare ${EXTENSION_API_VERSION}.`);
};

if (import.meta.main) main();
