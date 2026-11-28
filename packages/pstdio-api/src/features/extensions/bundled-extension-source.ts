import { join } from "node:path";
import { isRuntimeCliName } from "pstdio-extensions";
import {
  type BundledExtensionSources,
  readExtensionPackage,
  releaseBundleHost,
  unpackExtension,
} from "pstdio-extensions/distribution";

import type { PreparedNamedInstallSource } from "./install-extension-source-types";
import { readWarmedExtensionRelease } from "./prepared-release-bundle";

type EmbeddedSource = BundledExtensionSources["sources"][number];
const compatibleDescriptor = (source: EmbeddedSource) =>
  source.bundles?.find((part) => part.host === releaseBundleHost() && part.sourceSha256 === source.sha256);

const assetName = (file: Blob) => (file as Blob & { name?: string }).name?.replaceAll("\\", "/") ?? "";
export const readBundledExtensionSources = async (files = Bun.embeddedFiles) => {
  const manifest = files.find((file) => assetName(file).endsWith("extension-sources/manifest.json"));
  return manifest ? (JSON.parse(await manifest.text()) as BundledExtensionSources) : null;
};

const matchesRelease = (bundle: BundledExtensionSources, ref: string) => bundle.ref === ref || bundle.commit === ref;

const sourceArchive = (files: readonly Blob[], source: EmbeddedSource) =>
  files.find((file) => assetName(file).endsWith(`extension-sources/${encodeURIComponent(source.installName)}.tgz`));

export const readBundledExtensionRuntimeCli = async (
  id: string,
  origin: { url: string; path: string },
  files = Bun.embeddedFiles,
) => {
  const bundled = await readBundledExtensionSources(files);
  const source = bundled?.sources.find(
    (entry) => entry.id === id && entry.url === origin.url && entry.path === origin.path,
  );
  const archive = source && sourceArchive(files, source);
  if (!archive) return;
  const pkg = await readExtensionPackage(new Uint8Array(await archive.arrayBuffer()));
  const command: unknown = (await pkg.files.get("package.json")?.json())?.pstdio?.runtimeCli;
  return isRuntimeCliName(command) ? command : undefined;
};

export const findBundledExtensionSource = async (origin: { url: string; path: string }, ref: string) => {
  const bundle = await readBundledExtensionSources();
  if (!bundle || !matchesRelease(bundle, ref)) return null;
  const source = bundle.sources.find((entry) => entry.url === origin.url && entry.path === origin.path);
  if (!source) return null;
  const descriptor = compatibleDescriptor(source);
  return { commit: bundle.commit, version: source.version, ...(descriptor && { descriptor }) };
};

export const resolveBundledExtensionCommit = async (origin: { url: string; path: string }, ref: string) =>
  (await findBundledExtensionSource(origin, ref))?.commit ?? null;

export const prepareBundledExtensionSource = async (
  origin: { url: string; path: string },
  tempDir: string,
  ref: string,
  options: { signal?: AbortSignal; files?: File[] } = {},
): Promise<
  (Pick<PreparedNamedInstallSource, "path" | "runtimeBundle" | "preparedRelease"> & { commit: string }) | null
> => {
  options.signal?.throwIfAborted();
  const files = options.files ?? Bun.embeddedFiles;
  const bundle = await readBundledExtensionSources(files);
  if (!bundle || !matchesRelease(bundle, ref)) return null;
  const source = bundle.sources.find((entry) => entry.url === origin.url && entry.path === origin.path);
  if (!source) return null;
  const descriptor = compatibleDescriptor(source);
  const warmed = descriptor && (await readWarmedExtensionRelease(descriptor, source));
  if (warmed) return { ...warmed, commit: bundle.commit };
  const archive = sourceArchive(files, source);
  if (!archive) throw new Error(`Packaged extension source is missing: ${source.installName}`);
  const target = join(tempDir, "extension-source", encodeURIComponent(source.installName));
  await unpackExtension(new Uint8Array(await archive.arrayBuffer()), target, source);
  options.signal?.throwIfAborted();
  const runtime =
    descriptor && files.find((file) => assetName(file).endsWith(`extension-sources/runtime/${descriptor.sha256}.tgz`));
  const path = join(tempDir, "extension-runtime", `${descriptor?.sha256 ?? ""}.tgz`);
  if (runtime) await Bun.write(path, runtime);
  const runtimeBundle = runtime && descriptor ? { path, descriptor, sourceSha256: source.sha256 } : undefined;
  return { path: target, commit: bundle.commit, runtimeBundle };
};
