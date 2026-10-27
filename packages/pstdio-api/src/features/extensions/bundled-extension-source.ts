import { join } from "node:path";
import { type BundledExtensionSources, unpackExtension } from "pstdio-extensions/distribution";

const assetName = (file: Blob) => (file as Blob & { name?: string }).name?.replaceAll("\\", "/") ?? "";
const readBundle = async (files = Bun.embeddedFiles) => {
  const manifest = files.find((file) => assetName(file).endsWith("extension-sources/manifest.json"));
  return manifest ? (JSON.parse(await manifest.text()) as BundledExtensionSources) : null;
};

const matchesRelease = (bundle: BundledExtensionSources, ref: string) => bundle.ref === ref || bundle.commit === ref;

export const hasBundledExtensionSource = async (origin: { url: string; path: string }, ref: string) => {
  const bundle = await readBundle();
  return Boolean(
    bundle &&
      matchesRelease(bundle, ref) &&
      bundle.sources.some((source) => source.url === origin.url && source.path === origin.path),
  );
};

export const resolveBundledExtensionCommit = async (url: string, ref: string) => {
  const bundle = await readBundle();
  return bundle && matchesRelease(bundle, ref) && bundle.sources.some((source) => source.url === url)
    ? bundle.commit
    : null;
};

export const prepareBundledExtensionSource = async (
  origin: { url: string; path: string },
  tempDir: string,
  ref: string,
  options: { signal?: AbortSignal; files?: File[] } = {},
) => {
  options.signal?.throwIfAborted();
  const files = options.files ?? Bun.embeddedFiles;
  const bundle = await readBundle(files);
  if (!bundle || !matchesRelease(bundle, ref)) return null;
  const source = bundle.sources.find((entry) => entry.url === origin.url && entry.path === origin.path);
  if (!source) return null;
  const suffix = `extension-sources/${encodeURIComponent(source.installName)}.tgz`;
  const archive = files.find((file) => assetName(file).endsWith(suffix));
  if (!archive) throw new Error(`Packaged extension source is missing: ${source.installName}`);
  const target = join(tempDir, "extension-source", encodeURIComponent(source.installName));
  await unpackExtension(new Uint8Array(await archive.arrayBuffer()), target, source);
  options.signal?.throwIfAborted();
  return { path: target, commit: bundle.commit };
};
