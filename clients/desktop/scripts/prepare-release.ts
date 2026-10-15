import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { verifyMacOSAppTrust } from "../src/release/macos-app-trust";
import { parseDesktopReleaseTarget, prepareDesktopReleaseArtifacts } from "../src/release/release-artifacts";

const flag = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const desktopRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(desktopRoot, "../..");
const target = parseDesktopReleaseTarget(flag("--target") ?? `${process.platform}-${process.arch}`);
const notesPath = flag("--notes-file");
if (!notesPath) throw new Error("Desktop release preparation requires --notes-file");
const resolvedNotesPath = isAbsolute(notesPath) ? notesPath : resolve(repoRoot, notesPath);

if (target.startsWith("darwin-")) {
  if (process.platform !== "darwin") throw new Error("macOS release preparation requires macOS trust verification");
  await verifyMacOSAppTrust(join(desktopRoot, "out", `Prompt Studio-${target}`, "Prompt Studio.app"));
}

const result = prepareDesktopReleaseArtifacts({
  desktopRoot,
  runtimePackagePath: join(repoRoot, "packages", "pstdio", "package.json"),
  target,
  releaseNotes: readFileSync(resolvedNotesPath, "utf8").trim(),
  // Scheduled runs have no repository payload, so the variable can be empty.
  publishedAt: process.env.PSTDIO_DESKTOP_PUBLISHED_AT || new Date().toISOString(),
});

process.stdout.write(`Desktop release artifacts prepared at ${result.outputPath}\n`);
