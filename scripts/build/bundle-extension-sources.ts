import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BundledExtensionSources } from "pstdio-extensions/distribution";
import { buildReleaseRuntimeArtifact } from "./release-runtime-artifact";

// These built-in tools can be needed before existing 0.46–0.48 projects are usable.
const upgradeTools = new Set([
  "pstdio.planner", "pstdio.home", "pstdio.onboarding", "pstdio.session-browser",
  "pstdio.workspaces", "pstdio.pstdio-terminal", "pstdio.base-themes", "pstdio.skills",
  "pstdio.performance", "pstdio.harness-codex", "pstdio.harness-claude-code", "pstdio.harness-open-code",
]);

export const bundleExtensionSources = async (root: string) => {
  const { packExtensionSource } = await import("pstdio-extensions/distribution");
  const { readExtensionIcon, extensionIconAssetName } = await import("pstdio-extensions");
  const packageData = JSON.parse(await readFile(join(root, "packages/pstdio/package.json"), "utf8"));
  const repositoryData = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const repository = typeof repositoryData.repository === "string" ? repositoryData.repository : repositoryData.repository.url;
  const normalizeUrl = (url: string) => url.replace(/^git\+/, "").replace(/\.git\/?$/, "").replace(/\/$/, "");
  const catalog = JSON.parse(await readFile(join(root, "packages/pstdio-api/files/extension-catalog.json"), "utf8")) as {
    extensions: Array<{ installName: string; extensionId?: string; icon?: string; bundleSource?: boolean; origin: { url: string; path: string; ref: string } }>;
  };
  const destination = join(root, "packages/pstdio/files/extension-sources");
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const manifest: BundledExtensionSources = {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    ref: process.env.PSTDIO_EXTENSION_RELEASE_REF?.trim() || `pstdio@${packageData.version}`,
    sources: [],
  };
  for (const entry of catalog.extensions) {
    if (entry.origin.ref !== "{hostRelease}" || normalizeUrl(entry.origin.url) !== normalizeUrl(repository)) continue;
    if (entry.icon?.startsWith("./")) {
      const encoded = readExtensionIcon(join(root, entry.origin.path), entry.icon)!;
      await mkdir(join(destination, "icons"), { recursive: true });
      await writeFile(join(destination, "icons", extensionIconAssetName(entry)), Buffer.from(encoded.split(",")[1], "base64"));
    }
    if (entry.bundleSource === false) continue;
    const packed = await packExtensionSource(join(root, entry.origin.path));
    await writeFile(join(destination, `${encodeURIComponent(entry.installName)}.tgz`), packed.bytes);
    const prebuild = packed.manifest.id === "pstdio.planner" ||
      (process.env.PSTDIO_PREBUILD_UPGRADE_TOOLS === "1" && upgradeTools.has(packed.manifest.id));
    const runtime = prebuild && await buildReleaseRuntimeArtifact(root, { ...packed.manifest, bytes: packed.bytes, sha256: packed.sha256 });
    if (runtime) {
      const dir = join(destination, "runtime");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${runtime.descriptor.sha256}.tgz`), runtime.bytes);
    }
    manifest.sources.push({
      installName: entry.installName, url: entry.origin.url, path: entry.origin.path,
      id: packed.manifest.id, version: packed.manifest.version, sha256: packed.sha256,
      ...(runtime ? { bundles: [runtime.descriptor] } : {}),
    });
  }
  await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest));
  return manifest;
};
