import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BundledExtensionSources } from "pstdio-extensions/distribution";

export const bundleExtensionSources = async (root: string) => {
  const { packExtensionSource } = await import("pstdio-extensions/distribution");
  const packageData = JSON.parse(await readFile(join(root, "packages/pstdio/package.json"), "utf8"));
  const repositoryData = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const repository = typeof repositoryData.repository === "string" ? repositoryData.repository : repositoryData.repository.url;
  const normalizeUrl = (url: string) => url.replace(/^git\+/, "").replace(/\.git\/?$/, "").replace(/\/$/, "");
  const catalog = JSON.parse(await readFile(join(root, "packages/pstdio-api/files/extension-catalog.json"), "utf8")) as {
    extensions: Array<{ installName: string; bundleSource?: boolean; origin: { url: string; path: string; ref: string } }>;
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
    if (entry.bundleSource === false) continue;
    if (entry.origin.ref !== "{hostRelease}" || normalizeUrl(entry.origin.url) !== normalizeUrl(repository)) continue;
    const packed = await packExtensionSource(join(root, entry.origin.path));
    await writeFile(join(destination, `${encodeURIComponent(entry.installName)}.tgz`), packed.bytes);
    manifest.sources.push({
      installName: entry.installName, url: entry.origin.url, path: entry.origin.path,
      id: packed.manifest.id, version: packed.manifest.version, sha256: packed.sha256,
    });
  }
  await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest));
  return manifest;
};
