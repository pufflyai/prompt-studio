import { copyFile, link } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { releaseBundleHost, releaseBundleManifest } from "../runtime/prepared-revision";
import { extractEntries, extractFiles } from "./extract-files";
import { MAX_EXTENSION_PACKAGE_BYTES, packageSha256 } from "./package";
import { createPackageArchive } from "./package-archive";

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const extensionReleaseBundleSchema = z.object({
  host: z.string().min(1),
  sha256: digestSchema,
  sourceSha256: digestSchema,
  sizeBytes: z.number().int().positive().max(MAX_EXTENSION_PACKAGE_BYTES),
});
export type ExtensionReleaseBundle = z.infer<typeof extensionReleaseBundleSchema>;

const bundleManifestSchema = z.object({
  format: z.literal(1),
  extensionId: z.string().min(1),
  version: z.string().min(1),
  host: z.string().min(1),
  sourceSha256: digestSchema,
  webviews: z.array(z.string().min(1)).max(256),
  assets: z.record(z.string(), digestSchema).optional(),
});
type BundleManifest = z.infer<typeof bundleManifestSchema>;

export { releaseBundleHost };

export const releaseBundleEntry = "runtime.mjs";
export const releaseBundleViews = "webviews";
const safePath = (path: string) =>
  !/[:\\\0]/.test(path) && path.split("/").every((part) => part && part !== "." && part !== "..");

const assetPath = (digest: string) => `assets/${digest}`;
const viewIndex = (path: string) => /^webviews\/(0|[1-9]\d*)\//.exec(path)?.[1];

const verifyViewPaths = (paths: Iterable<string>, views: string[]) => {
  const seen = new Set<string>();
  for (const path of paths) {
    const key = path.normalize("NFD").toLowerCase();
    const index = viewIndex(path);
    if (!safePath(path) || seen.has(key) || index === undefined || Number(index) >= views.length)
      throw new Error("Extension runtime bundle contains an unsafe webview path.");
    seen.add(key);
  }
};

const validateBundlePaths = (files: ReadonlyMap<string, File>, manifest: BundleManifest) => {
  const body = [...files.keys()].filter((path) => path !== releaseBundleManifest && path !== releaseBundleEntry);
  const assets = manifest.assets;
  if (!assets) {
    verifyViewPaths(body, manifest.webviews);
    return;
  }
  verifyViewPaths(Object.keys(assets), manifest.webviews);
  const expected = new Set(Object.values(assets).map(assetPath));
  if (expected.size !== body.length || body.some((path) => !expected.has(path)))
    throw new Error("Extension runtime bundle does not contain its declared assets.");
};

const readReleaseBundle = async (bytes: Uint8Array, expected?: ExtensionReleaseBundle) => {
  if (bytes.byteLength > MAX_EXTENSION_PACKAGE_BYTES) throw new Error("Extension runtime bundle is too large.");
  if (expected && (bytes.byteLength !== expected.sizeBytes || packageSha256(bytes) !== expected.sha256))
    throw new Error("Extension runtime bundle checksum or size mismatch.");
  const tar = gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 });
  const files = await new Bun.Archive(tar).files();
  const manifest = bundleManifestSchema.parse(await files.get(releaseBundleManifest)?.json());
  if (expected && (manifest.host !== expected.host || manifest.sourceSha256 !== expected.sourceSha256))
    throw new Error("Extension runtime bundle does not match its release.");
  if (!files.has(releaseBundleEntry)) throw new Error("Extension runtime bundle has no entry.");
  if (new Set(manifest.webviews).size !== manifest.webviews.length)
    throw new Error("Extension runtime bundle contains duplicate views.");

  for (const [index] of manifest.webviews.entries()) {
    const entry = `${releaseBundleViews}/${index}/module.js`;
    if (!(manifest.assets ? manifest.assets[entry] : files.has(entry)))
      throw new Error("Extension runtime bundle is missing a webview entry.");
  }
  validateBundlePaths(files, manifest);
  return { files, manifest };
};

export const inspectExtensionReleaseBundle = async (bytes: Uint8Array) => {
  const { manifest } = await readReleaseBundle(bytes);
  return {
    manifest,
    descriptor: extensionReleaseBundleSchema.parse({
      host: manifest.host,
      sourceSha256: manifest.sourceSha256,
      sha256: packageSha256(bytes),
      sizeBytes: bytes.byteLength,
    }),
  };
};

// Each prepared view carries the same shared chunks. Store each asset's bytes once.
const deduplicateViews = (files: Record<string, Uint8Array>) => {
  const archive: Record<string, Uint8Array> = {};
  const assets: Record<string, string> = {};
  for (const [path, bytes] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    if (path === releaseBundleEntry) archive[path] = bytes;
    else {
      const digest = packageSha256(bytes);
      assets[path] = digest;
      archive[assetPath(digest)] = bytes;
    }
  }
  return { archive, assets };
};

export const packExtensionReleaseBundle = async (
  input: Omit<BundleManifest, "format" | "host" | "assets">,
  files: Record<string, Uint8Array>,
) => {
  const { archive, assets } = deduplicateViews(files);
  const manifest: BundleManifest = {
    ...input,
    format: 1,
    host: releaseBundleHost(),
    ...(Object.keys(assets).length ? { assets } : {}),
  };
  const bytes = await createPackageArchive({
    ...archive,
    [releaseBundleManifest]: new TextEncoder().encode(JSON.stringify(manifest)),
  });
  const descriptor = extensionReleaseBundleSchema.parse({
    host: manifest.host,
    sourceSha256: manifest.sourceSha256,
    sha256: packageSha256(bytes),
    sizeBytes: bytes.byteLength,
  });
  await readReleaseBundle(bytes, descriptor);
  return { bytes, descriptor };
};

export const unpackExtensionReleaseBundle = async (
  bytes: Uint8Array,
  descriptor: ExtensionReleaseBundle,
  extension: { id: string; version: string; sha256: string },
  destination: string,
) => {
  extensionReleaseBundleSchema.parse(descriptor);
  if (descriptor.host !== releaseBundleHost()) throw new Error("Extension runtime bundle is for a different host.");
  const { files, manifest } = await readReleaseBundle(bytes, descriptor);
  if (
    manifest.extensionId !== extension.id ||
    manifest.version !== extension.version ||
    manifest.sourceSha256 !== extension.sha256
  )
    throw new Error("Extension runtime bundle has a different release identity.");
  await extractFiles(destination, files);
  await extractEntries(destination, Object.entries(manifest.assets ?? {}), async (target, digest) => {
    const shared = join(destination, assetPath(digest));
    await link(shared, target).catch(() => copyFile(shared, target));
  });
  return manifest;
};
