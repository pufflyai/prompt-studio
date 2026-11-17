import { accessSync, constants, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { version } from "../package.json";
import { resolvePackagedLayout } from "../src/packaging/package-layout";
import { validateSidecarArtifact } from "../src/runtime/sidecar-artifact";

const layout = resolvePackagedLayout(resolve(import.meta.dirname, ".."), process.platform, process.arch);
if (!statSync(layout.executable).isFile()) throw new Error(`Desktop package is missing: ${layout.executable}`);
accessSync(layout.executable, constants.X_OK);
await validateSidecarArtifact({
  resourcesPath: dirname(dirname(layout.sidecar)),
  platform: process.platform,
  arch: process.arch,
  appVersion: version,
});
console.log(`Desktop test package verified: ${layout.root}`);
